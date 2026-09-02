import { getUserProfile, saveUserProfile } from "../../models/profile/userProfileModel.js";
import { sendResponse } from "../../utils/response.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^\d{7,15}$/;
const cleanText = (value) => String(value ?? "").trim();

export const getMyProfile = async (req, res, next) => {
    try {
        const profile = await getUserProfile(req.auth.userId);
        if (!profile) return sendResponse(res, 404, "User profile not found");
        return sendResponse(res, 200, "User profile fetched successfully", profile);
    } catch (error) {
        return next(error);
    }
};

export const updateMyProfile = async (req, res, next) => {
    const details = {
        userId: req.auth.userId,
        profilePicUrl: cleanText(req.body.profilePicUrl) || null,
        firstName: cleanText(req.body.firstName),
        lastName: cleanText(req.body.lastName),
        email: cleanText(req.body.email).toLowerCase(),
        alternativeMobile: cleanText(req.body.alternativeMobile).replace(/[\s-]/g, "") || null,
    };
    if (!details.firstName || !details.lastName) {
        return sendResponse(res, 400, "First name and last name are required");
    }
    if (!EMAIL_PATTERN.test(details.email)) return sendResponse(res, 400, "Provide a valid email address");
    if (details.alternativeMobile && !MOBILE_PATTERN.test(details.alternativeMobile)) {
        return sendResponse(res, 400, "Provide a valid alternative mobile number");
    }
    try {
        const result = await saveUserProfile(details);
        if (result.status === "user_not_found") return sendResponse(res, 404, "Verified user not found");
        if (result.status === "same_mobile") {
            return sendResponse(res, 400, "Alternative mobile must differ from the registered mobile");
        }
        return sendResponse(res, 200, "Details are filled successfully");
    } catch (error) {
        return next(error);
    }
};

