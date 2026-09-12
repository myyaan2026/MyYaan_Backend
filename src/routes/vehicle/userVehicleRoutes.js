import express from "express";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import {
    addMyVehicle,
    getBookingOptions,
    getMyVehicle,
    getVehicleTypes,
    listVehicleCompanies,
    listVehicleModels,
    listMyVehicles,
    makeMyVehiclePrimary,
    removeMyVehicle,
    updateMyVehicle,
} from "../../controller/vehicle/userVehicleController.js";

const router = express.Router();
const customerOnly = [authenticate, requireRole("user")];

router.get("/users/vehicle-types", ...customerOnly, getVehicleTypes);
router.get("/users/vehicle-companies", ...customerOnly, listVehicleCompanies);
router.get("/users/vehicle-models", ...customerOnly, listVehicleModels);
router.get("/users/vehicle-details", ...customerOnly, listMyVehicles);
router.post("/users/vehicle-details", ...customerOnly, addMyVehicle);
router.get("/users/vehicle-details/:vehicleId", ...customerOnly, getMyVehicle);
router.put("/users/vehicle-details/:vehicleId", ...customerOnly, updateMyVehicle);
router.patch("/users/vehicle-details/:vehicleId/primary", ...customerOnly, makeMyVehiclePrimary);
router.delete("/users/vehicle-details/:vehicleId", ...customerOnly, removeMyVehicle);
router.get("/users/service-booking-options", ...customerOnly, getBookingOptions);

export default router;
