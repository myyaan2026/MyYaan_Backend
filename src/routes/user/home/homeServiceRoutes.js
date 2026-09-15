import express from "express";
import { authenticate, requireRole } from "../../../middlewares/auth.js";
import { listHomeServices } from "../../../controller/user/home/homeServiceController.js";

const router = express.Router();
router.get("/users/home/services", authenticate, requireRole("user"), listHomeServices);

export default router;
