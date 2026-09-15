import express from "express";
import { authenticate, requireRole } from "../../../middlewares/auth.js";
import { getMySubServiceCapabilities, getMyVehicleCapabilities, updateMySubServiceCapabilities, updateMyVehicleCapabilities } from "../../../controller/service_partner/capabilities/servicePartnerCapabilitiesController.js";

const router=express.Router();
const partnerOnly=[authenticate,requireRole("service_partner")];
router.get("/service-partners/capabilities/sub-services",...partnerOnly,getMySubServiceCapabilities);
router.put("/service-partners/capabilities/sub-services",...partnerOnly,updateMySubServiceCapabilities);
router.get("/service-partners/capabilities/vehicles",...partnerOnly,getMyVehicleCapabilities);
router.put("/service-partners/capabilities/vehicles",...partnerOnly,updateMyVehicleCapabilities);
export default router;
