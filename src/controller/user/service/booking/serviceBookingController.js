import {
    applyCouponDiscount,
    cancelUserBooking,
    createBookingEntry,
    getAvailableCoupons,
    getAvailableTimeSlots,
    getBookingStartData,
    getServiceOptionsData,
    getUserBookingById,
    getUserBookings,
    reviewBookingData,
} from "../../../../models/user/service/booking/serviceBookingModel.js";
import { createRazorpayOrderForBooking } from "../../../../services/payment/razorpayService.js";
import {
    getPartnerDeviceTokens,
    sendBookingNotificationToCustomer,
    sendBookingNotificationToPartner,
    sendMulticastNotification,
} from "../../../../services/notification/firebaseNotificationService.js";
import { sendResponse } from "../../../../utils/response.js";

const positiveId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const isValidDate = (dateStr) => /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));

export const getBookingOptions = async (req, res, next) => {
    const serviceId = positiveId(req.query.serviceId);
    if (!serviceId) return sendResponse(res, 400, "serviceId query parameter is required");
    const vehicleId = req.query.vehicleId === undefined ? null : positiveId(req.query.vehicleId);
    if (req.query.vehicleId !== undefined && !vehicleId) return sendResponse(res, 400, "vehicleId must be a positive integer");
    const subServiceId = req.query.subServiceId === undefined ? null : positiveId(req.query.subServiceId);
    if (req.query.subServiceId !== undefined && !subServiceId) return sendResponse(res, 400, "subServiceId must be a positive integer");

    try {
        if (subServiceId) {
            const data = await getServiceOptionsData({
                userId: req.auth.userId,
                serviceId,
                subServiceId,
                vehicleId,
            });
            if (data.status === "vehicle_required") {
                return sendResponse(res, 409, "Please add a vehicle before booking a service", { code: "VEHICLE_DETAILS_REQUIRED" });
            }
            if (data.status === "vehicle_not_found") return sendResponse(res, 404, "Selected vehicle not found");
            if (data.status === "service_not_available") {
                return sendResponse(res, 400, "Selected service is disabled or is not available for the selected vehicle");
            }
            if (data.status === "sub_service_not_available") {
                return sendResponse(res, 400, "Selected delivery mode / sub-service is not available for this service");
            }
            const { status, ...resultData } = data;
            return sendResponse(res, 200, "Service options fetched successfully", resultData);
        }

        const data = await getBookingStartData(req.auth.userId, serviceId, vehicleId);
        if (data.status === "vehicle_required") {
            return sendResponse(res, 409, "Please add a vehicle before booking a service", { code: "VEHICLE_DETAILS_REQUIRED" });
        }
        if (data.status === "service_not_available") {
            return sendResponse(res, 400, "Selected service is disabled or is not available for the selected vehicle");
        }
        if (data.status === "vehicle_not_found") return sendResponse(res, 404, "Selected vehicle not found");
        const { status, ...resultData } = data;
        return sendResponse(res, 200, "Booking options fetched successfully", resultData);
    } catch (error) {
        return next(error);
    }
};

export const getServiceOptions = async (req, res, next) => {
    const serviceId = positiveId(req.query.serviceId);
    if (!serviceId) return sendResponse(res, 400, "serviceId query parameter is required");
    const vehicleId = req.query.vehicleId === undefined ? null : positiveId(req.query.vehicleId);
    if (req.query.vehicleId !== undefined && !vehicleId) return sendResponse(res, 400, "vehicleId must be a positive integer");
    const subServiceId = req.query.subServiceId === undefined ? null : positiveId(req.query.subServiceId);
    if (req.query.subServiceId !== undefined && !subServiceId) return sendResponse(res, 400, "subServiceId must be a positive integer");

    try {
        const data = await getServiceOptionsData({
            userId: req.auth.userId,
            serviceId,
            subServiceId,
            vehicleId,
        });
        if (data.status === "vehicle_required") {
            return sendResponse(res, 409, "Please add a vehicle before booking a service", { code: "VEHICLE_DETAILS_REQUIRED" });
        }
        if (data.status === "vehicle_not_found") return sendResponse(res, 404, "Selected vehicle not found");
        if (data.status === "service_not_available") {
            return sendResponse(res, 400, "Selected service is disabled or is not available for the selected vehicle");
        }
        if (data.status === "sub_service_not_available") {
            return sendResponse(res, 400, "Selected delivery mode / sub-service is not available for this service");
        }
        const { status, ...resultData } = data;
        return sendResponse(res, 200, "Service options fetched successfully", resultData);
    } catch (error) {
        return next(error);
    }
};

export const getAvailableSlots = async (req, res, next) => {
    const serviceCenterId = positiveId(req.query.serviceCenterId);
    const dateParam = req.query.date !== undefined && String(req.query.date).trim() !== ""
        ? String(req.query.date).trim()
        : null;

    if (!serviceCenterId) {
        return sendResponse(res, 400, "serviceCenterId query parameter is required and must be a positive integer");
    }
    if (dateParam && !isValidDate(dateParam)) {
        return sendResponse(res, 400, "Invalid date format. Expected YYYY-MM-DD");
    }
    try {
        const data = await getAvailableTimeSlots({ serviceCenterId, date: dateParam });
        if (data.status === "center_not_found") return sendResponse(res, 404, "Active service centre not found");
        return sendResponse(res, 200, "Available time slots fetched successfully", data);
    } catch (error) {
        return next(error);
    }
};

export const listCoupons = async (_req, res, next) => {
    try {
        const coupons = await getAvailableCoupons();
        return sendResponse(res, 200, "Coupons fetched successfully", coupons);
    } catch (error) {
        return next(error);
    }
};

export const applyCoupon = async (req, res, next) => {
    const couponCode = req.body?.couponCode;
    const orderAmount = Number(req.body?.orderAmount);
    if (!couponCode || !Number.isFinite(orderAmount) || orderAmount <= 0) {
        return sendResponse(res, 400, "Provide valid couponCode and positive orderAmount");
    }
    try {
        const result = await applyCouponDiscount({ couponCode, orderAmount });
        if (!result.isValid) {
            return sendResponse(res, 400, result.message, { isValid: false });
        }
        return sendResponse(res, 200, result.message, result);
    } catch (error) {
        return next(error);
    }
};

export const reviewBooking = async (req, res, next) => {
    const {
        serviceCenterId,
        vehicleId,
        serviceId,
        subServiceId,
        serviceOptionId,
        bookingDate,
        bookingTimeSlot,
        couponCode,
    } = req.body || {};

    const centerId = positiveId(serviceCenterId);
    const vId = positiveId(vehicleId);
    const sId = positiveId(serviceId);
    const subId = positiveId(subServiceId);
    const optId = positiveId(serviceOptionId);

    if (!centerId || !vId || !sId || !subId || !optId || !isValidDate(bookingDate) || !bookingTimeSlot) {
        return sendResponse(
            res,
            400,
            "Provide positive serviceCenterId, vehicleId, serviceId, subServiceId, serviceOptionId, valid bookingDate, and bookingTimeSlot"
        );
    }

    try {
        const data = await reviewBookingData({
            userId: req.auth.userId,
            serviceCenterId: centerId,
            vehicleId: vId,
            serviceId: sId,
            subServiceId: subId,
            serviceOptionId: optId,
            bookingDate,
            bookingTimeSlot,
            couponCode,
        });

        if (data.status === "vehicle_not_found") return sendResponse(res, 404, "Selected vehicle not found");
        if (data.status === "center_not_found") return sendResponse(res, 404, "Service centre not found or inactive");
        if (data.status === "service_not_available") return sendResponse(res, 400, "Selected service is not available");
        if (data.status === "sub_service_not_available") return sendResponse(res, 400, "Selected delivery mode is not available");
        if (data.status === "service_option_not_available") return sendResponse(res, 400, "Selected service option is not available for this vehicle");
        if (data.status === "invalid_time_slot") return sendResponse(res, 400, "Invalid time slot format");
        if (data.status === "invalid_coupon") return sendResponse(res, 400, data.message || "Invalid coupon code");

        return sendResponse(res, 200, "Booking review details fetched successfully", data);
    } catch (error) {
        return next(error);
    }
};

export const createBooking = async (req, res, next) => {
    const {
        serviceCenterId,
        vehicleId,
        serviceId,
        subServiceId,
        serviceOptionId,
        bookingDate,
        bookingTimeSlot,
        paymentMode,
        couponCode,
        notes,
    } = req.body || {};

    const centerId = positiveId(serviceCenterId);
    const vId = positiveId(vehicleId);
    const sId = positiveId(serviceId);
    const subId = positiveId(subServiceId);
    const optId = positiveId(serviceOptionId);

    if (!centerId || !vId || !sId || !subId || !optId || !isValidDate(bookingDate) || !bookingTimeSlot || !paymentMode) {
        return sendResponse(
            res,
            400,
            "Provide positive serviceCenterId, vehicleId, serviceId, subServiceId, serviceOptionId, valid bookingDate, bookingTimeSlot, and paymentMode (PAY_NOW or PAY_LATER)"
        );
    }

    try {
        const result = await createBookingEntry({
            userId: req.auth.userId,
            serviceCenterId: centerId,
            vehicleId: vId,
            serviceId: sId,
            subServiceId: subId,
            serviceOptionId: optId,
            bookingDate,
            bookingTimeSlot,
            paymentMode,
            couponCode,
            notes,
        });

        if (result.status === "vehicle_not_found") return sendResponse(res, 404, "Selected vehicle not found");
        if (result.status === "center_not_found") return sendResponse(res, 404, "Service centre not found or inactive");
        if (result.status === "service_not_available") return sendResponse(res, 400, "Selected service is not available");
        if (result.status === "sub_service_not_available") return sendResponse(res, 400, "Selected delivery mode is not available");
        if (result.status === "service_option_not_available") return sendResponse(res, 400, "Selected service option is not available for this vehicle");
        if (result.status === "invalid_time_slot") return sendResponse(res, 400, "Invalid time slot format");
        if (result.status === "invalid_coupon") return sendResponse(res, 400, result.message || "Invalid coupon code");
        if (result.status === "invalid_payment_mode") return sendResponse(res, 400, "paymentMode must be PAY_NOW or PAY_LATER");
        if (result.status === "slot_not_available") return sendResponse(res, 409, "Selected time slot is already fully booked. Please select another slot.");

        const booking = result.booking;

        // If user chose PAY_NOW, automatically generate Razorpay order for instant checkout
        if (booking.paymentMode === "PAY_NOW") {
            const rzpRes = await createRazorpayOrderForBooking({
                userId: req.auth.userId,
                bookingId: booking.bookingId,
            });
            if (rzpRes.status === "ok") {
                booking.razorpay = rzpRes.order;
            }
        } else {
            // For PAY_LATER: booking is confirmed immediately, notify service partner and customer
            sendBookingNotificationToPartner(booking).catch((err) =>
                console.error("[Notification] Partner notification failed:", err)
            );
            sendBookingNotificationToCustomer({
                userId: req.auth.userId,
                bookingNumber: booking.bookingNumber,
                title: "Booking Confirmed! 🚗",
                body: `Your booking #${booking.bookingNumber} is confirmed for ${booking.bookingDate} (${booking.bookingTimeSlot}).`,
            }).catch((err) => console.error("[Notification] Customer notification failed:", err));
        }

        return sendResponse(res, 201, "Service booking created successfully", booking);
    } catch (error) {
        return next(error);
    }
};

export const cancelBooking = async (req, res, next) => {
    const bookingId = positiveId(req.params.bookingId || req.query.bookingId || req.body?.bookingId);
    if (!bookingId) {
        return sendResponse(res, 400, "Booking ID must be a positive integer (pass via path parameter /bookings/:bookingId, query ?bookingId=, or JSON body)");
    }
    const reason = req.body?.reason ? String(req.body.reason).trim() : "Cancelled by user";
    try {
        const result = await cancelUserBooking({
            userId: req.auth.userId,
            bookingId,
            cancellationReason: reason,
        });
        if (result.status === "not_found") return sendResponse(res, 404, "Booking not found");
        if (result.status === "already_cancelled") return sendResponse(res, 400, "Booking is already cancelled");
        if (result.status === "cannot_cancel_completed") return sendResponse(res, 400, "Cannot cancel a completed service");

        // Notify partner of cancellation asynchronously
        if (result.serviceCenterId) {
            getPartnerDeviceTokens(result.serviceCenterId).then((devices) => {
                if (devices.length > 0) {
                    const tokens = devices.map((d) => d.pushToken);
                    sendMulticastNotification({
                        tokens,
                        title: "Booking Cancelled ⚠️",
                        body: `Booking #${result.bookingNumber} was cancelled by the customer. Reason: ${reason}`,
                        data: {
                            type: "BOOKING_CANCELLED",
                            bookingId: String(result.bookingId),
                            bookingNumber: String(result.bookingNumber),
                        },
                    }).catch((e) => console.error("[Notification] Cancel partner notification error:", e));
                }
            }).catch((e) => console.error("[Notification] Fetch partner tokens error:", e));
        }

        return sendResponse(res, 200, "Booking cancelled successfully", result);
    } catch (error) {
        return next(error);
    }
};

export const listMyBookings = async (req, res, next) => {
    const specificBookingId = positiveId(req.query.bookingId);
    if (specificBookingId) {
        return getMyBooking(req, res, next);
    }
    const type = req.query.type || req.query.tag || null;
    try {
        const data = await getUserBookings(req.auth.userId, type);
        return sendResponse(res, 200, "Service history fetched successfully", data);
    } catch (error) {
        return next(error);
    }
};

export const getMyBooking = async (req, res, next) => {
    const bookingId = positiveId(req.params.bookingId || req.query.bookingId);
    if (!bookingId) return sendResponse(res, 400, "Booking ID must be a positive integer");
    try {
        const booking = await getUserBookingById(req.auth.userId, bookingId);
        if (!booking) return sendResponse(res, 404, "Booking not found");
        return sendResponse(res, 200, "Booking details fetched successfully", booking);
    } catch (error) {
        return next(error);
    }
};
