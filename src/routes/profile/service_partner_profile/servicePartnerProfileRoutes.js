import express from "express";
import {
    getMyServices,
    updateMyServices,
} from "../../../controller/service_partner/servicePartnerController.js";
import { authenticate, requireRole } from "../../../middlewares/auth.js";

const router = express.Router();

router.use("/service-partners", authenticate);
router.use("/service-partners", requireRole("service_partner"));

// Service List and update service offering
router.get("/service-partners/services", getMyServices);
router.put("/service-partners/services", updateMyServices);

export default router;
