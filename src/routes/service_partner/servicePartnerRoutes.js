import express from "express";
import {
    createCenter, getCenter, getCenterServices, getOnboarding, getServiceById,
    listCenters, listServices, updateCenter, updateServiceOffers,
} from "../../controller/service_partner/servicePartnerController.js";
import { authenticate, requireRole } from "../../middlewares/auth.js";

const router = express.Router();
router.use(authenticate, requireRole("service_partner"));
router.get("/services", listServices);
router.get("/service", getServiceById);
router.get("/service-partners/onboarding", getOnboarding);
router.get("/service-partners/service-centres", listCenters);
router.get("/service-partners/service-centre", getCenter);
router.post("/service-partners/service-centres", createCenter);
router.put("/service-partners/service-centres", updateCenter);
router.get("/service-partners/services", getCenterServices);
router.put("/service-partners/services", updateServiceOffers);
export default router;
