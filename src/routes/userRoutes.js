import express from "express";

import { getUserById, requestOtp, verifyOtp } from "../controller/userController.js";

const router = express.Router();

router.post("/users/request-otp", requestOtp);
router.post("/users/verify-otp", verifyOtp);
router.get("/users/:id", getUserById);

export default router;
