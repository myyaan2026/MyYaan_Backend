import crypto from "node:crypto";
import {
    createOtp,
    getUserByIdService,
    verifyOtp as verifyOtpService,
} from "../models/userModel.js";

const OTP_EXPIRY_MINUTES = 5;
const MOBILE_PATTERN = /^\d{7,15}$/;
const sendResponse = (res, status, message, data = null) => res.status(status).json({ status, message, data });
const normalizeMobile = (mobile) => String(mobile ?? "").replace(/[\s-]/g, "");
const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

const requestOtpForRole = (role) => async (req, res, next) => {
    const mobile = normalizeMobile(req.body.mobile);
    if (!MOBILE_PATTERN.test(mobile)) {
        return sendResponse(res, 400, "Provide a valid mobile number containing 7 to 15 digits");
    }
    try {
        const otp = crypto.randomInt(100000, 1000000).toString();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
        const otpRecord = await createOtp(mobile, role, hashOtp(otp), expiresAt);
        if (otpRecord.isLoginDisabled) {
            return sendResponse(res, 403, "User account is disabled by admin. Please connect with the MyYaan team");
        }
        const data = { userId: otpRecord.user_id, mobile, role, expiresAt: otpRecord.expires_at };
        // For local Thunder Client testing only. In production, deliver this by SMS.
        if (process.env.NODE_ENV !== "production") data.otp = otp;
        return sendResponse(res, 201, "OTP generated successfully", data);
    } catch (error) {
        return next(error);
    }
};

const verifyOtpForRole = (role) => async (req, res, next) => {
    const mobile = normalizeMobile(req.body.mobile);
    const otp = String(req.body.otp ?? "").trim();
    if (!MOBILE_PATTERN.test(mobile) || !/^\d{6}$/.test(otp)) {
        return sendResponse(res, 400, "Provide a valid mobile number and 6-digit OTP");
    }
    try {
        const user = await verifyOtpService(mobile, role, hashOtp(otp));
        if (!user) return sendResponse(res, 400, "Invalid or expired OTP");
        return sendResponse(res, 200, "OTP verified successfully", user);
    } catch (error) {
        return next(error);
    }
};

// Customer app OTP flow.
export const requestOtp = requestOtpForRole("user");
export const verifyOtp = verifyOtpForRole("user");

// Service-partner app OTP flow.
export const requestServicePartnerOtp = requestOtpForRole("service_partner");
export const verifyServicePartnerOtp = verifyOtpForRole("service_partner");

// GET /api/users/:id
export const getUserById = async (req, res, next) => {
    const userId = Number(req.params.id);
    if (!Number.isSafeInteger(userId) || userId < 1) {
        return sendResponse(res, 400, "User ID must be a positive integer");
    }
    try {
        const user = await getUserByIdService(userId);
        if (!user) return sendResponse(res, 404, "User not found");
        return sendResponse(res, 200, "User fetched successfully", user);
    } catch (error) {
        return next(error);
    }
};
