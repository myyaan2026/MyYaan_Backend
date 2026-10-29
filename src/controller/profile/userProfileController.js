import {
    getUserProfile,
    requestAccountDeletion,
    saveUserProfile,
} from "../../models/profile/userProfileModel.js";
import {
    getMediaFileById,
    getMediaFileByMediaCode,
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
    let profilePicMediaCode = null;
    let profilePicUrl = cleanText(req.body.profilePicUrl) || null;

    if (rawPicId !== undefined && rawPicId !== null && String(rawPicId).trim() !== "") {
        const token = String(rawPicId).trim();

        // 1. Look up by media_code (e.g. med_2ca0b57344c0b57cb5a6e11ec0f09c70 or med_up_...)
        let media = await getMediaFileByMediaCode(token);

        // 2. If not found, attempt decrypting AES-256 token
        if (!media) {
            const decrypted = decryptMediaToken(token);
            if (decrypted?.mediaId) {
                media = await getMediaFileById(decrypted.mediaId);
            } else if (decrypted?.uuidToken) {
                media = await getMediaFileByUuid(decrypted.uuidToken);
            }
        }

        // 3. Fallbacks for numeric ID or UUID
        if (!media && /^\d+$/.test(token)) {
            media = await getMediaFileById(parseInt(token, 10));
        }

        if (!media) {
            media = await getMediaFileByUuid(token);
        }

        if (!media) {
            return sendResponse(res, 404, "Profile picture media file not found");
        }

        profilePicId = media.mediaId;
        profilePicMediaCode = media.mediaCode || null;
        const publicMediaId = media.mediaCode || encryptMediaId(media.mediaId, media.uuidToken);
        profilePicUrl = `/api/media/${publicMediaId}`;
    } else if (profilePicUrl) {
        const urlMatch = profilePicUrl.match(/\/media\/([a-zA-Z0-9_.-]+)/);
        if (urlMatch) {
            const token = urlMatch[1];
            let media = await getMediaFileByMediaCode(token);
            if (!media) {
                const decrypted = decryptMediaToken(token);
                if (decrypted?.mediaId) {
                    media = await getMediaFileById(decrypted.mediaId);
                } else if (/^\d+$/.test(token)) {
                    media = await getMediaFileById(parseInt(token, 10));
                }
            }
            if (media) {
                profilePicId = media.mediaId;
                profilePicMediaCode = media.mediaCode || null;
                const publicMediaId = media.mediaCode || encryptMediaId(media.mediaId, media.uuidToken);
                profilePicUrl = `/api/media/${publicMediaId}`;
            }
        }
    }

    const details = {
        userId: req.auth.userId,
        updateProfilePic: hasPicField,
        profilePicId,
        profilePicMediaCode,
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

