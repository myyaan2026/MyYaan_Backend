import express from "express";
import { getMyProfile, updateMyProfile } from "../../../controller/profile/userProfileController.js";
import {
    getMyServiceCenterAddress,
    getMyServices,
    updateMyServiceCenterAddress,
    updateMyServices,
} from "../../../controller/service_partner/servicePartnerController.js";
import { authenticate, requireRole } from "../../../middlewares/auth.js";

const router = express.Router();

router.use("/service-partners", authenticate);

// Personal profile data is shared by consumer and service-partner accounts.
router.get("/service-partners/personal-details", getMyProfile);
router.put("/service-partners/personal-details", updateMyProfile);

// Service-centre and service-offering data belongs only to service partners.
router.use("/service-partners", requireRole("service_partner"));
router.get("/service-partners/service-centre-address", getMyServiceCenterAddress);
router.put("/service-partners/service-centre-address", updateMyServiceCenterAddress);

//Service List and update service offering
router.get("/service-partners/services", getMyServices);
router.put("/service-partners/services", updateMyServices);

export default router;
