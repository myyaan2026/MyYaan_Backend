import crypto from "node:crypto";
import pool from "../../config/db.js";
import { getRazorpayClient, isRazorpayConfigured } from "../../config/razorpay.js";
import {
    getPaymentByRazorpayOrderId,
    insertPaymentOrder,
    markPaymentFailed,
    markPaymentSuccessful,
} from "../../models/payment/paymentModel.js";
import {
    sendBookingNotificationToCustomer,
    sendBookingNotificationToPartner,
} from "../notification/firebaseNotificationService.js";

/**
 * Creates a Razorpay Order for a service booking
 */
export const createRazorpayOrderForBooking = async ({ userId, bookingId }) => {
    // 1. Fetch booking details
    const bookingRes = await pool.query(
        `SELECT b.booking_id, b.booking_number, b.user_id, b.service_center_id,
                b.final_amount, b.payment_status, b.booking_status, b.booking_date, b.booking_time_slot,
                COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), 'Customer') AS customer_name,
                p.email AS customer_email,
                u.mobile AS customer_mobile
         FROM service_bookings b
         JOIN users u ON u.user_id = b.user_id
         LEFT JOIN user_profiles p ON p.user_id = u.user_id
         WHERE b.booking_id = $1 AND b.user_id = $2`,
        [bookingId, userId]
    );

    if (!bookingRes.rowCount) {
        return { status: "booking_not_found" };
    }

    const booking = bookingRes.rows[0];

    if (booking.booking_status === "CANCELLED") {
        return { status: "booking_cancelled", message: "Cannot pay for a cancelled booking" };
    }

    if (booking.payment_status === "PAID") {
        return { status: "already_paid", message: "This booking is already paid" };
    }

    const finalAmount = Number(booking.final_amount);
    if (finalAmount <= 0) {
        return { status: "invalid_amount", message: "Booking final amount must be greater than zero" };
    }

    // Razorpay requires amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(finalAmount * 100);
    const receipt = booking.booking_number.substring(0, 40); // Max 40 chars

    const razorpay = getRazorpayClient();

    let razorpayOrderId;

    if (razorpay) {
        try {
            const order = await razorpay.orders.create({
                amount: amountInPaise,
                currency: "INR",
                receipt,
                notes: {
                    bookingId: String(booking.booking_id),
                    bookingNumber: String(booking.booking_number),
                    userId: String(booking.user_id),
                },
            });
            razorpayOrderId = order.id;
        } catch (error) {
            console.error("[Razorpay] Error creating order via API:", error);
            return {
                status: "gateway_error",
                message: error.error?.description || error.message || "Failed to create Razorpay order",
            };
        }
    } else {
        // Fallback simulated order when keys are not configured yet in .env
        const rand = crypto.randomBytes(8).toString("hex");
        razorpayOrderId = `order_sim_${rand}`;
        console.warn(`[Razorpay] Simulated order created (${razorpayOrderId}) because Razorpay credentials are not in .env`);
    }

    // 2. Save order in booking_payments table
    await insertPaymentOrder({
        bookingId: booking.booking_id,
        userId: booking.user_id,
        razorpayOrderId,
        amount: finalAmount,
        currency: "INR",
        metadata: {
            bookingNumber: booking.booking_number,
            customerName: booking.customer_name,
        },
    });

    return {
        status: "ok",
        order: {
            keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
            orderId: razorpayOrderId,
            amount: amountInPaise,
            currency: "INR",
            bookingId: booking.booking_id,
            bookingNumber: booking.booking_number,
            customer: {
                name: booking.customer_name || "Customer",
                email: booking.customer_email || "",
                contact: booking.customer_mobile || "",
            },
        },
    };
};

/**
 * Verifies Razorpay payment signature and marks booking as PAID
 */
export const verifyRazorpayPayment = async ({
    userId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
}) => {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return {
            status: "invalid_payload",
            message: "razorpayOrderId, razorpayPaymentId, and razorpaySignature are required",
        };
    }

    // 1. Fetch payment record
    const paymentRecord = await getPaymentByRazorpayOrderId(razorpayOrderId);
    if (!paymentRecord) {
        return { status: "order_not_found", message: "Razorpay order not found" };
    }

    if (paymentRecord.userId !== userId) {
        return { status: "unauthorized", message: "Order does not belong to the authenticated user" };
    }

    if (paymentRecord.status === "PAID") {
        return {
            status: "already_verified",
            message: "Payment has already been verified",
            bookingId: paymentRecord.bookingId,
        };
    }

    // 2. Cryptographic HMAC-SHA256 signature verification
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (secret) {
        const generatedSignature = crypto
            .createHmac("sha256", secret)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest("hex");

        if (generatedSignature !== razorpaySignature) {
            console.error(`[Razorpay Security] Signature mismatch! Generated: ${generatedSignature}, Received: ${razorpaySignature}`);
            await markPaymentFailed({
                razorpayOrderId,
                errorCode: "BAD_SIGNATURE",
                errorDescription: "Payment signature verification failed",
            });
            return {
                status: "signature_verification_failed",
                message: "Invalid payment signature. Payment verification failed.",
            };
        }
    } else {
        if (process.env.NODE_ENV === "production") {
            return {
                status: "configuration_error",
                message: "Payment gateway key secret not configured on server",
            };
        }
        console.warn("[Razorpay] Skipping cryptographic signature check: RAZORPAY_KEY_SECRET not set in .env");
    }

    // 3. Verify payment details with Razorpay API (amount & captured status)
    const razorpay = getRazorpayClient();
    let paymentMethod = null;

    if (razorpay) {
        try {
            const rzpPayment = await razorpay.payments.fetch(razorpayPaymentId);
            if (rzpPayment) {
                paymentMethod = rzpPayment.method || null;
                const expectedAmountInPaise = Math.round(Number(paymentRecord.amount) * 100);

                if (rzpPayment.amount !== expectedAmountInPaise) {
                    console.error(`[Razorpay Security] Amount mismatch! Expected ${expectedAmountInPaise}, Got ${rzpPayment.amount}`);
                    return {
                        status: "amount_mismatch",
                        message: "Paid amount does not match expected order amount",
                    };
                }

                if (rzpPayment.status !== "captured" && rzpPayment.status !== "authorized") {
                    return {
                        status: "payment_not_successful",
                        message: `Payment status is ${rzpPayment.status}`,
                    };
                }
            }
        } catch (fetchError) {
            console.error("[Razorpay] Error verifying payment with Razorpay API:", fetchError);
        }
    }

    // 4. Update database status
    const updateResult = await markPaymentSuccessful({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        paymentMethod,
    });

    if (updateResult.status !== "ok") {
        return updateResult;
    }

    // 5. Query detailed booking info to send notification to Service Partner & User
    try {
        const fullBookingRes = await pool.query(
            `SELECT b.booking_id AS "bookingId", b.booking_number AS "bookingNumber",
                    b.booking_date AS "bookingDate", b.booking_time_slot AS "bookingTimeSlot",
                    b.final_amount AS "finalAmount", b.payment_mode AS "paymentMode",
                    b.payment_status AS "paymentStatus", b.service_center_id AS "serviceCenterId",
                    s.service_name AS "serviceName", opt.service_option_name AS "serviceOptionName",
                    COALESCE(bikeComp.company_name, carComp.company_name) AS "companyName",
                    COALESCE(bikeMod.model_name, carMod.model_name) AS "modelName",
                    uv.vehicle_number AS "vehicleNumber"
             FROM service_bookings b
             JOIN service_types s ON s.service_id = b.service_id
             JOIN service_options opt ON opt.service_option_id = b.service_option_id
             LEFT JOIN user_vehicle_details uv ON uv.vehicle_id = b.vehicle_id
             LEFT JOIN bike_companies bikeComp ON bikeComp.bike_company_id = uv.bike_company_id
             LEFT JOIN car_companies carComp ON carComp.car_company_id = uv.car_company_id
             LEFT JOIN bike_models bikeMod ON bikeMod.bike_model_id = uv.bike_model_id
             LEFT JOIN car_models carMod ON carMod.car_model_id = uv.car_model_id
             WHERE b.booking_id = $1`,
            [paymentRecord.bookingId]
        );

        if (fullBookingRes.rowCount) {
            const b = fullBookingRes.rows[0];
            const bookingPayload = {
                serviceCenterId: b.serviceCenterId,
                bookingId: b.bookingId,
                bookingNumber: b.bookingNumber,
                bookingDate: b.bookingDate,
                bookingTimeSlot: b.bookingTimeSlot,
                vehicle: {
                    companyName: b.companyName,
                    modelName: b.modelName,
                    vehicleNumber: b.vehicleNumber,
                },
                service: {
                    serviceName: b.serviceName,
                    serviceOptionName: b.serviceOptionName,
                },
                pricing: {
                    finalAmount: b.finalAmount,
                },
                paymentMode: "PAY_NOW",
                paymentStatus: "PAID",
            };

            // Notify partner asynchronously
            sendBookingNotificationToPartner(bookingPayload).catch((e) =>
                console.error("[Notification] Partner notification failed:", e)
            );

            // Notify customer asynchronously
            sendBookingNotificationToCustomer({
                userId,
                bookingNumber: b.bookingNumber,
                title: "Payment Successful! 🎉",
                body: `Your payment of ₹${b.finalAmount} for booking #${b.bookingNumber} was successful. Service is confirmed.`,
            }).catch((e) => console.error("[Notification] Customer notification failed:", e));
        }
    } catch (notifErr) {
        console.error("[Notification] Post-payment notification dispatch error:", notifErr);
    }

    return {
        status: "ok",
        payment: updateResult.payment,
        booking: updateResult.booking,
    };
};

/**
 * Verify Razorpay Webhook signature
 */
export const verifyWebhookSignature = (rawBody, signature) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.warn("[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured in .env");
        return true;
    }

    const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

    return expectedSignature === signature;
};

