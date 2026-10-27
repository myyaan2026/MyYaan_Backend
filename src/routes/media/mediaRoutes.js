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
    upload.any()(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    status: 400,
                    message: "File size exceeds 5MB limit",
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

