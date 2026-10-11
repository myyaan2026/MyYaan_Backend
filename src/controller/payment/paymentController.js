import {
    createRazorpayOrderForBooking,
    verifyRazorpayPayment,
    verifyWebhookSignature,
} from "../../services/payment/razorpayService.js";
import { getLatestPaymentByBookingId, markPaymentSuccessful } from "../../models/payment/paymentModel.js";
import { sendResponse } from "../../utils/response.js";

const positiveId = (val) => (Number.isSafeInteger(Number(val)) && Number(val) > 0 ? Number(val) : null);

/**
 * POST /api/users/payments/razorpay/create-order
 * Create a new Razorpay order for an existing booking.
 */
export const createPaymentOrder = async (req, res, next) => {
    const bookingId = positiveId(req.body?.bookingId || req.query?.bookingId);
    if (!bookingId) {
        return sendResponse(res, 400, "bookingId is required and must be a positive integer");
    }

    try {
        const result = await createRazorpayOrderForBooking({
            userId: req.auth.userId,
            bookingId,
        });

        if (result.status === "booking_not_found") {
            return sendResponse(res, 404, "Booking not found or does not belong to you");
        }
        if (result.status === "booking_cancelled") {
            return sendResponse(res, 400, result.message);
        }
        if (result.status === "already_paid") {
            return sendResponse(res, 400, result.message);
        }
        if (result.status === "invalid_amount") {
            return sendResponse(res, 400, result.message);
        }
        if (result.status === "gateway_error") {
            return sendResponse(res, 502, result.message);
        }

        return sendResponse(res, 200, "Razorpay order created successfully", result.order);
    } catch (error) {
        return next(error);
    }
};

/**
 * POST /api/users/payments/razorpay/verify
 * Cryptographically verify payment signature returned by Razorpay client SDK.
 */
export const verifyPayment = async (req, res, next) => {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return sendResponse(
            res,
            400,
            "razorpayOrderId, razorpayPaymentId, and razorpaySignature are required"
        );
    }

    try {
        const result = await verifyRazorpayPayment({
            userId: req.auth.userId,
            razorpayOrderId: String(razorpayOrderId).trim(),
            razorpayPaymentId: String(razorpayPaymentId).trim(),
            razorpaySignature: String(razorpaySignature).trim(),
        });

        if (result.status === "order_not_found") {
            return sendResponse(res, 404, result.message);
        }
        if (result.status === "unauthorized") {
            return sendResponse(res, 403, result.message);
        }
        if (result.status === "signature_verification_failed") {
            return sendResponse(res, 400, result.message);
        }
        if (result.status === "amount_mismatch") {
            return sendResponse(res, 400, result.message);
        }
        if (result.status === "payment_not_successful") {
            return sendResponse(res, 400, result.message);
        }
        if (result.status === "already_verified") {
            return sendResponse(res, 200, "Payment was already verified successfully", {
                bookingId: result.bookingId,
                status: "PAID",
            });
        }

        return sendResponse(res, 200, "Payment verified successfully", {
            payment: result.payment,
            booking: result.booking,
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * GET /api/users/payments/booking/:bookingId
 * Get payment and transaction details for a booking
 */
export const getBookingPaymentStatus = async (req, res, next) => {
    const bookingId = positiveId(req.params.bookingId);
    if (!bookingId) {
        return sendResponse(res, 400, "bookingId must be a positive integer");
    }

    try {
        const payment = await getLatestPaymentByBookingId(bookingId);
        if (!payment) {
            return sendResponse(res, 404, "No payment records found for this booking");
        }
        if (payment.userId !== req.auth.userId) {
            return sendResponse(res, 403, "You are not authorized to view this payment");
        }

        return sendResponse(res, 200, "Payment details fetched successfully", payment);
    } catch (error) {
        return next(error);
    }
};

/**
 * POST /api/payments/razorpay/webhook
 * Razorpay server-to-server webhook endpoint for payment event reconciliation
 */
export const handleRazorpayWebhook = async (req, res, next) => {
    const signature = req.headers["x-razorpay-signature"];

    const rawBody = typeof req.rawBody === "string" ? req.rawBody : JSON.stringify(req.body);

    if (signature && !verifyWebhookSignature(rawBody, signature)) {
        console.error("[Razorpay Webhook] Invalid webhook signature detected!");
        return sendResponse(res, 400, "Invalid webhook signature");
    }

    const event = req.body?.event;
    const payload = req.body?.payload;

    try {
        if (event === "payment.captured" || event === "order.paid") {
            const paymentEntity = payload?.payment?.entity;
            const orderEntity = payload?.order?.entity;
            const orderId = paymentEntity?.order_id || orderEntity?.id;
            const paymentId = paymentEntity?.id;

            if (orderId && paymentId) {
                await markPaymentSuccessful({
                    razorpayOrderId: orderId,
                    razorpayPaymentId: paymentId,
                    razorpaySignature: signature || "webhook_verified",
                    paymentMethod: paymentEntity?.method,
                    metadata: { webhookEvent: event },
                });
                console.log(`[Razorpay Webhook] Successfully reconciled order ${orderId} via ${event}`);
            }
        }

        return res.status(200).json({ status: "ok" });
    } catch (error) {
        console.error("[Razorpay Webhook] Error processing webhook:", error);
        return res.status(500).json({ status: "error", message: error.message });
    }
};
