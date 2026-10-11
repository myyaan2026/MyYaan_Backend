import express from "express";
import {
    createCenter, getCenter, getCenterPricing, getCenterServices, getOnboarding, getServiceById,
    listCenters, listServices, updateCenter, updateCenterPricing, updateServiceOffers,
} from "../../controller/service_partner/servicePartnerController.js";
import { authenticate, requireRole } from "../../middlewares/auth.js";

const router = express.Router();
const servicePartnerOnly = [authenticate, requireRole("service_partner")];

router.get("/services", ...servicePartnerOnly, listServices);
router.get("/service", ...servicePartnerOnly, getServiceById);
router.get("/service-partners/onboarding", ...servicePartnerOnly, getOnboarding);
router.get("/service-partners/service-centres", ...servicePartnerOnly, listCenters);
router.get("/service-partners/service-centre", ...servicePartnerOnly, getCenter);
router.post("/service-partners/service-centres", ...servicePartnerOnly, createCenter);
router.put("/service-partners/service-centres", ...servicePartnerOnly, updateCenter);
router.get("/service-partners/service-centres/services", ...servicePartnerOnly, getCenterServices);
router.put("/service-partners/service-centres/services", ...servicePartnerOnly, updateServiceOffers);
router.get("/service-partners/service-centres/pricing", ...servicePartnerOnly, getCenterPricing);
router.put("/service-partners/service-centres/pricing", ...servicePartnerOnly, updateCenterPricing);
export default router;
