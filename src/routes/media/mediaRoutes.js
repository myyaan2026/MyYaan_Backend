import express from "express";
import multer from "multer";
import { serveMedia, uploadMedia } from "../../controller/media/mediaController.js";
import { optionalAuthenticate } from "../../middlewares/auth.js";

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
});

const uploadMiddleware = (req, res, next) => {
    const contentType = String(req.headers["content-type"] ?? "").toLowerCase();
    // If client sends JSON payload (e.g. base64 image), bypass multer completely
    if (contentType.includes("application/json")) {
        return next();
    }

    upload.any()(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    status: 400,
                    message: "File size exceeds 5MB limit",
                });
            }
            if (err.message && err.message.includes("Unexpected end of form")) {
                return res.status(400).json({
                    status: 400,
                    message: "Multipart form upload failed: Unexpected end of form. Please ensure you are sending the request over HTTPS (https://api.myyaan.com), and in Postman do NOT manually select or set the 'Content-Type' header in the Headers tab (Postman generates it automatically with the boundary when using Body -> form-data).",
                });
            }
            return res.status(400).json({
                status: 400,
                message: err.message,
            });
        }
        if (req.files && req.files.length > 0) {
            req.file = req.files[0];
        }
        return next();
    });
};

// Image Upload APIs
router.post("/media/upload", optionalAuthenticate, uploadMiddleware, uploadMedia);
router.post("/users/media/upload", optionalAuthenticate, uploadMiddleware, uploadMedia);
router.post("/users/profile/upload-image", optionalAuthenticate, uploadMiddleware, uploadMedia);

// Binary Image Retrieval API
router.get("/media/:mediaId", serveMedia);

export default router;

