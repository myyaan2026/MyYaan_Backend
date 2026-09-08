import {
    getUserVehicleDetails,
    getVehicleCompanies,
    getVehicleModels,
    saveUserVehicleDetails,
} from "../../models/vehicle/userVehicleModel.js";
import { sendResponse } from "../../utils/response.js";

const VEHICLE_TYPES = new Set(["BIKE", "ELECTRIC_BIKE", "CAR", "ELECTRIC_CAR"]);
const normaliseType = (value) => String(value ?? "").trim().toUpperCase().replace(/[ -]+/g, "_");
const positiveInteger = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const normaliseVehicleNumber = (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const readVehicleType = (req, res) => {
    const vehicleType = normaliseType(req.query.vehicleType);
    if (!VEHICLE_TYPES.has(vehicleType)) {
        sendResponse(res, 400, "vehicleType must be Bike, Electric Bike, Car, or Electric Car");
        return null;
    }
    return vehicleType;
};

export const getVehicleTypes = (_req, res) => sendResponse(res, 200, "Vehicle types fetched successfully", [
    { code: "BIKE", name: "Bike" },
    { code: "ELECTRIC_BIKE", name: "Electric Bike" },
    { code: "CAR", name: "Car" },
    { code: "ELECTRIC_CAR", name: "Electric Car" },
]);

export const listVehicleCompanies = async (req, res, next) => {
    const vehicleType = readVehicleType(req, res);
    if (!vehicleType) return;
    try {
        return sendResponse(res, 200, "Vehicle companies fetched successfully", await getVehicleCompanies(vehicleType));
    } catch (error) { return next(error); }
};

export const listVehicleModels = async (req, res, next) => {
    const vehicleType = readVehicleType(req, res);
    if (!vehicleType) return;
    const companyId = req.query.companyId === undefined ? null : positiveInteger(req.query.companyId);
    if (req.query.companyId !== undefined && !companyId) return sendResponse(res, 400, "companyId must be a positive integer");
    try {
        return sendResponse(res, 200, "Vehicle models fetched successfully", await getVehicleModels(vehicleType, companyId));
    } catch (error) { return next(error); }
};

export const getMyVehicleDetails = async (req, res, next) => {
    try {
        const vehicle = await getUserVehicleDetails(req.auth.userId);
        return sendResponse(res, 200, "Vehicle details fetched successfully", {
            isVehicleDetailsFilled: Boolean(vehicle),
            vehicle,
        });
    } catch (error) { return next(error); }
};

export const putMyVehicleDetails = async (req, res, next) => {
    const vehicleType = normaliseType(req.body.vehicleType);
    const companyId = positiveInteger(req.body.companyId);
    const modelId = positiveInteger(req.body.modelId);
    const vehicleNumber = normaliseVehicleNumber(req.body.vehicleNumber);
    if (!VEHICLE_TYPES.has(vehicleType) || !companyId || !modelId || !/^[A-Z0-9]{4,20}$/.test(vehicleNumber)) {
        return sendResponse(res, 400, "Provide vehicleType, positive companyId and modelId, and a valid vehicleNumber");
    }
    try {
        const result = await saveUserVehicleDetails({ userId: req.auth.userId, vehicleType, companyId, modelId, vehicleNumber });
        if (result.status === "invalid_catalog") return sendResponse(res, 400, "Selected model does not belong to this company and vehicle type");
        if (result.status === "user_not_found") return sendResponse(res, 404, "Verified user not found");
        if (result.status === "vehicle_number_in_use") return sendResponse(res, 409, "Vehicle number is already registered to another user");
        return sendResponse(res, 200, "Vehicle details saved successfully", {
            isVehicleDetailsFilled: true,
            vehicle: await getUserVehicleDetails(req.auth.userId),
        });
    } catch (error) { return next(error); }
};
