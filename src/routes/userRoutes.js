import express from "express";

import {
    getUserById,
    requestOtp,
    requestServicePartnerOtp,
    verifyOtp,
    verifyServicePartnerOtp,
} from "../controller/userController.js";

const router = express.Router();

router.post("/users/request-otp", requestOtp);
router.post("/users/verify-otp", verifyOtp);
router.post("/service-partners/request-otp", requestServicePartnerOtp);
router.post("/service-partners/verify-otp", verifyServicePartnerOtp);
router.get("/users/:id", getUserById);

export default router;
