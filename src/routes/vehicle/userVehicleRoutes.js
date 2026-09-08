import express from "express";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import {
    getMyVehicleDetails,
    getVehicleTypes,
    listVehicleCompanies,
    listVehicleModels,
    putMyVehicleDetails,
} from "../../controller/vehicle/userVehicleController.js";

const router = express.Router();
router.use(authenticate, requireRole("user"));

router.get("/users/vehicle-types", getVehicleTypes);
router.get("/users/vehicle-companies", listVehicleCompanies);
router.get("/users/vehicle-models", listVehicleModels);
router.get("/users/vehicle-details", getMyVehicleDetails);
router.put("/users/vehicle-details", putMyVehicleDetails);

export default router;
