import express from "express";
import { authenticate, requireRole } from "../../../../middlewares/auth.js";
import { getBookingOptions } from "../../../../controller/user/service/booking/serviceBookingController.js";

const router = express.Router();
router.get("/users/service-booking-options", authenticate, requireRole("user"), getBookingOptions);

export default router;
