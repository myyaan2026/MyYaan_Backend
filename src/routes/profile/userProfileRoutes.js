import express from "express";
import {
    deleteMyAccount,
    getMyProfile,
    updateMyProfile,
} from "../../controller/profile/userProfileController.js";
import { authenticate } from "../../middlewares/auth.js";

const router = express.Router();

router.get("/users/profile", authenticate, getMyProfile);
router.put("/users/profile", authenticate, updateMyProfile);

router.delete("/users/account", authenticate, deleteMyAccount);
router.delete("/users/profile", authenticate, deleteMyAccount);
router.post("/users/account/delete", authenticate, deleteMyAccount);

export default router;
