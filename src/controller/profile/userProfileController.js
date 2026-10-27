import {
    getUserProfile,
    requestAccountDeletion,
    saveUserProfile,
} from "../../models/profile/userProfileModel.js";
import {
    getMediaFileById,
    getMediaFileByUuid,
} from "../../models/media/mediaModel.js";
import { decryptMediaToken, encryptMediaId } from "../../utils/mediaCrypto.js";
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
    const rawPicId = req.body.profilePicId ?? req.body.profile_pic_id ?? req.body.mediaId;
    const hasPicField = rawPicId !== undefined || req.body.profilePicUrl !== undefined;

    let profilePicId = null;
    let encryptedPicId = null;
    let profilePicUrl = cleanText(req.body.profilePicUrl) || null;

    if (rawPicId !== undefined && rawPicId !== null && String(rawPicId).trim() !== "") {
        const token = String(rawPicId).trim();
        const decrypted = decryptMediaToken(token);
        let numericId = decrypted?.mediaId;

        if (!numericId && /^\d+$/.test(token)) {
            numericId = parseInt(token, 10);
        }
        if (!numericId && decrypted?.uuidToken) {
            const mediaByUuid = await getMediaFileByUuid(decrypted.uuidToken);
            if (mediaByUuid) {
                numericId = mediaByUuid.mediaId;
            }
        }

        if (!numericId) {
            return sendResponse(res, 400, "Invalid media ID provided for profile picture");
        }

        const media = await getMediaFileById(numericId);
        if (!media) {
            return sendResponse(res, 404, "Profile picture media file not found");
        }

        profilePicId = media.mediaId;
        encryptedPicId = encryptMediaId(media.mediaId, media.uuidToken);
        profilePicUrl = `/api/media/${encryptedPicId}`;
    } else if (profilePicUrl) {
        const urlMatch = profilePicUrl.match(/\/media\/([a-zA-Z0-9_.-]+)/);
        if (urlMatch) {
            const token = urlMatch[1];
            const decrypted = decryptMediaToken(token);
            let numericId = decrypted?.mediaId;
            if (!numericId && /^\d+$/.test(token)) {
                numericId = parseInt(token, 10);
            }
            if (numericId) {
                const media = await getMediaFileById(numericId);
                if (media) {
                    profilePicId = media.mediaId;
                    encryptedPicId = encryptMediaId(media.mediaId, media.uuidToken);
                    profilePicUrl = `/api/media/${encryptedPicId}`;
                }
            }
        }
    }

    const details = {
        userId: req.auth.userId,
        updateProfilePic: hasPicField,
        profilePicId,
        encryptedProfilePicId: encryptedPicId,
        profilePicUrl,
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
        const updatedProfile = await getUserProfile(req.auth.userId);
        return sendResponse(res, 200, "Details are filled successfully", updatedProfile);
    } catch (error) {
        return next(error);
    }
};

export const deleteMyAccount = async (req, res, next) => {
    try {
        const result = await requestAccountDeletion(req.auth.userId);
        if (!result) return sendResponse(res, 404, "User account not found or already disabled");
        return sendResponse(
            res,
            200,
            "We have received your account deletion request. Your account and related data will be permanently deleted within 30 days. If you log in again within 30 days, your deletion request will be cancelled automatically and your account will remain active.",
            result
        );
    } catch (error) {
        return next(error);
    }
};

