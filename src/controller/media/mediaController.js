import path from "node:path";
import {
    getMediaFileById,
    getMediaFileByMediaCode,
    getMediaFileByUuid,
    saveMediaFile,
} from "../../models/media/mediaModel.js";
import { decryptMediaToken, encryptMediaId } from "../../utils/mediaCrypto.js";
import { sendResponse } from "../../utils/response.js";

const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
    "image/svg+xml",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Detects image mime type from initial buffer magic numbers.
 */
const detectMimeType = (buffer) => {
    if (!buffer || buffer.length < 4) return null;
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return "image/jpeg";
    }
    // PNG: 89 50 4E 47
    if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
    ) {
        return "image/png";
    }
    // GIF: 47 49 46
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        return "image/gif";
    }
    // WEBP: RIFF....WEBP
    if (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
        return "image/webp";
    }
    return null;
};

/**
 * Parses a data URL or base64 string into a Buffer and mimeType.
 */
const parseBase64Image = (dataString, fallbackMime = "image/jpeg") => {
    if (!dataString || typeof dataString !== "string") return null;
    const trimmed = dataString.trim();
    const dataUriMatch = trimmed.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
    if (dataUriMatch) {
        const mimeType = dataUriMatch[1].toLowerCase();
        const buffer = Buffer.from(dataUriMatch[2], "base64");
        return { mimeType, buffer };
    }
    try {
        const buffer = Buffer.from(trimmed, "base64");
        if (buffer.length === 0) return null;
        const detected = detectMimeType(buffer) || fallbackMime;
        return { mimeType: detected, buffer };
    } catch {
        return null;
    }
};

/**
 * Upload image handler: saves raw image binary directly into database.
 * Returns encrypted mediaId and access URL.
 */
export const uploadMedia = async (req, res, next) => {
    try {
        let fileBuffer = null;
        let mimeType = null;
        let originalName = "profile_image.jpg";

        if (req.file) {
            fileBuffer = req.file.buffer;
            mimeType = (req.file.mimetype || "").toLowerCase();
            originalName = req.file.originalname || originalName;
        } else if (req.body) {
            const rawPayload =
                req.body.image ||
                req.body.file ||
                req.body.profilePic ||
                req.body.media;
            if (rawPayload) {
                const parsed = parseBase64Image(rawPayload, req.body.mimeType);
                if (parsed) {
                    fileBuffer = parsed.buffer;
                    mimeType = parsed.mimeType;
                    if (req.body.fileName) {
                        originalName = req.body.fileName;
                    }
                }
            }
        }

        if (!fileBuffer || fileBuffer.length === 0) {
            return sendResponse(res, 400, "Please provide an image file (multipart or base64)");
        }

        // Verify or refine mime type
        const detectedMime = detectMimeType(fileBuffer);
        if (detectedMime) {
            mimeType = detectedMime;
        }

        if (mimeType === "image/jpg") mimeType = "image/jpeg";

        if (!ALLOWED_MIME_TYPES.has(mimeType)) {
            return sendResponse(
                res,
                400,
                `Unsupported image type: ${mimeType}. Allowed formats: JPEG, PNG, WEBP, GIF, HEIC`
            );
        }

        if (fileBuffer.length > MAX_FILE_SIZE) {
            return sendResponse(
                res,
                400,
                `File size exceeds 5MB limit. Current size: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)}MB`
            );
        }

        // Sanitize file name
        const cleanBaseName = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileName = cleanBaseName || `image_${Date.now()}.jpg`;

        const userId = req.auth?.userId ? parseInt(req.auth.userId, 10) : null;

        const saved = await saveMediaFile({
            userId,
            fileName,
            mimeType,
            fileSize: fileBuffer.length,
            fileData: fileBuffer,
        });

        const returnedMediaId = saved.mediaCode || encryptMediaId(saved.mediaId, saved.uuidToken);
        const mediaUrl = `/api/media/${returnedMediaId}`;

        return sendResponse(res, 201, "Image uploaded successfully", {
            mediaId: returnedMediaId,
            fileName: saved.fileName,
            mimeType: saved.mimeType,
            fileSize: saved.fileSize,
            url: mediaUrl,
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * Serves raw image binary directly from PostgreSQL with caching headers.
 */
export const serveMedia = async (req, res, next) => {
    try {
        const { mediaId } = req.params;
        if (!mediaId) {
            return res.status(400).json({ status: 400, message: "Media ID is required" });
        }

        // 1. Look up by media_code first (e.g. med_2ca0b57344c0b57cb5a6e11ec0f09c70 or catalog med_bc_1)
        let media = await getMediaFileByMediaCode(mediaId);

        // 2. If not found, attempt decrypting AES-256 token
        if (!media) {
            const decrypted = decryptMediaToken(mediaId);
            if (decrypted?.mediaId) {
                media = await getMediaFileById(decrypted.mediaId);
            } else if (decrypted?.uuidToken) {
                media = await getMediaFileByUuid(decrypted.uuidToken);
            }
        }

        // 3. Fallbacks for numeric ID or UUID
        if (!media && /^\d+$/.test(mediaId)) {
            media = await getMediaFileById(parseInt(mediaId, 10));
        }

        if (!media) {
            media = await getMediaFileByUuid(mediaId);
        }

        if (!media || !media.fileData) {
            return res.status(404).json({ status: 404, message: "Media not found" });
        }

        const etag = `"media-${media.mediaId}-${new Date(media.updatedAt || media.createdAt).getTime()}"`;
        if (req.headers["if-none-match"] === etag) {
            return res.status(304).end();
        }

        res.setHeader("Content-Type", media.mimeType || "application/octet-stream");
        res.setHeader("Content-Length", media.fileSize || media.fileData.length);
        res.setHeader("ETag", etag);
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(media.fileName)}"`);

        return res.end(media.fileData);
    } catch (error) {
        return next(error);
    }
};
