import express from "express";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import {
    createPaymentOrder,
    getBookingPaymentStatus,
    handleRazorpayWebhook,
    verifyPayment,
} from "../../controller/payment/paymentController.js";

const router = express.Router();
const userOnly = [authenticate, requireRole("user")];

// Authenticated user payment routes
router.post("/users/payments/razorpay/create-order", ...userOnly, createPaymentOrder);
router.post("/users/payments/razorpay/verify", ...userOnly, verifyPayment);
router.get("/users/payments/booking/:bookingId", ...userOnly, getBookingPaymentStatus);

// Public webhook route (signature-verified)
router.post("/payments/razorpay/webhook", handleRazorpayWebhook);

export default router;

