import express from "express";
import { authenticate, requireRole } from "../../../../middlewares/auth.js";
import {
    applyCoupon,
    cancelBooking,
    createBooking,
    getAvailableSlots,
    getBookingOptions,
    getMyBooking,
    getServiceOptions,
    listCoupons,
    listMyBookings,
    reviewBooking,
} from "../../../../controller/user/service/booking/serviceBookingController.js";

const router = express.Router();
const userOnly = [authenticate, requireRole("user")];

router.get("/users/service-booking-options", ...userOnly, getBookingOptions);
router.get("/users/service-options", ...userOnly, getServiceOptions);
router.get("/users/bookings/available-slots", ...userOnly, getAvailableSlots);
router.get("/users/coupons", ...userOnly, listCoupons);
router.post("/users/coupons/apply", ...userOnly, applyCoupon);
router.post("/users/bookings/review", ...userOnly, reviewBooking);
router.post("/users/bookings", ...userOnly, createBooking);
router.get("/users/bookings", ...userOnly, listMyBookings);
router.get("/users/bookings/:bookingId", ...userOnly, getMyBooking);
router.post("/users/bookings/:bookingId/cancel", ...userOnly, cancelBooking);
router.post("/users/bookings/cancel", ...userOnly, cancelBooking);
router.patch("/users/bookings/:bookingId/cancel", ...userOnly, cancelBooking);
router.patch("/users/bookings/cancel", ...userOnly, cancelBooking);

export default router;
