import express from "express";
import { getMyProfile, updateMyProfile } from "../../controller/profile/userProfileController.js";
import { authenticate } from "../../middlewares/auth.js";

const router = express.Router();

router.get("/users/profile", authenticate, getMyProfile);
router.put("/users/profile", authenticate, updateMyProfile);

export default router;
