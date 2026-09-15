import express from "express";
import { authenticate, requireRole } from "../../../../middlewares/auth.js";
import { listNearbyServicePartners } from "../../../../controller/user/service/discovery/servicePartnerDiscoveryController.js";

const router = express.Router();
router.get("/users/service-partners", authenticate, requireRole("user"), listNearbyServicePartners);

export default router;
