import {
    createUserVehicle, deleteUserVehicle, getBookingStartData, getUserVehicleById, getUserVehicles,
    getVehicleCompanies, getVehicleModels, setPrimaryUserVehicle, updateUserVehicle,
} from "../../models/vehicle/userVehicleModel.js";
import { sendResponse } from "../../utils/response.js";

const TYPES = new Set(["BIKE", "ELECTRIC_BIKE", "CAR", "ELECTRIC_CAR"]);
const typeOf = (value) => String(value ?? "").trim().toUpperCase().replace(/[ -]+/g, "_");
const idOf = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const numberOf = (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const booleanOf = (value) => value === true || value === "true";

const validType = (req, res) => {
    const vehicleType = typeOf(req.query.vehicleType);
    if (!TYPES.has(vehicleType)) { sendResponse(res, 400, "vehicleType must be Bike, Electric Bike, Car, or Electric Car"); return null; }
    return vehicleType;
};
const vehicleInput = (body, vehicleId = null) => ({
    vehicleId, vehicleType: typeOf(body.vehicleType), companyId: idOf(body.companyId), modelId: idOf(body.modelId),
    vehicleNumber: numberOf(body.vehicleNumber), isPrimary: body.isPrimary === undefined ? undefined : booleanOf(body.isPrimary),
});
const inputError = (details) => !TYPES.has(details.vehicleType) || !details.companyId || !details.modelId || !/^[A-Z0-9]{4,20}$/.test(details.vehicleNumber);
const saveError = (res, result) => {
    if (result.status === "invalid_catalog") return sendResponse(res, 400, "Selected model does not belong to this company and vehicle type");
    if (result.status === "user_not_found") return sendResponse(res, 404, "Verified user not found");
    if (result.status === "vehicle_number_in_use") return sendResponse(res, 409, "Vehicle number is already registered to another user");
    if (result.status === "not_found") return sendResponse(res, 404, "Vehicle not found");
    return null;
};

export const getVehicleTypes = (_req, res) => sendResponse(res, 200, "Vehicle types fetched successfully", [
    { code: "BIKE", name: "Bike" }, { code: "ELECTRIC_BIKE", name: "Electric Bike" },
    { code: "CAR", name: "Car" }, { code: "ELECTRIC_CAR", name: "Electric Car" },
]);
export const listVehicleCompanies = async (req, res, next) => {
    const vehicleType = validType(req, res); if (!vehicleType) return;
    try { return sendResponse(res, 200, "Vehicle companies fetched successfully", await getVehicleCompanies(vehicleType)); } catch (error) { return next(error); }
};
export const listVehicleModels = async (req, res, next) => {
    const vehicleType = validType(req, res); if (!vehicleType) return;
    const companyId = req.query.companyId === undefined ? null : idOf(req.query.companyId);
    if (req.query.companyId !== undefined && !companyId) return sendResponse(res, 400, "companyId must be a positive integer");
    try { return sendResponse(res, 200, "Vehicle models fetched successfully", await getVehicleModels(vehicleType, companyId)); } catch (error) { return next(error); }
};

export const listMyVehicles = async (req, res, next) => {
    try { return sendResponse(res, 200, "Vehicle list fetched successfully", await getUserVehicles(req.auth.userId)); } catch (error) { return next(error); }
};
export const getMyVehicle = async (req, res, next) => {
    const vehicleId = idOf(req.params.vehicleId); if (!vehicleId) return sendResponse(res, 400, "Vehicle ID must be a positive integer");
    try {
        const vehicle = await getUserVehicleById(req.auth.userId, vehicleId);
        return vehicle ? sendResponse(res, 200, "Vehicle details fetched successfully", vehicle) : sendResponse(res, 404, "Vehicle not found");
    } catch (error) { return next(error); }
};
export const addMyVehicle = async (req, res, next) => {
    const details = vehicleInput(req.body); if (inputError(details)) return sendResponse(res, 400, "Provide vehicleType, positive companyId and modelId, and a valid vehicleNumber");
    try {
        const result = await createUserVehicle({ ...details, userId: req.auth.userId }); const error = saveError(res, result); if (error) return error;
        return sendResponse(res, 201, "Vehicle added successfully", await getUserVehicleById(req.auth.userId, result.vehicleId));
    } catch (error) { return next(error); }
};
export const updateMyVehicle = async (req, res, next) => {
    const vehicleId = idOf(req.params.vehicleId); const details = vehicleInput(req.body, vehicleId);
    if (!vehicleId || inputError(details)) return sendResponse(res, 400, "Provide vehicle ID, vehicleType, positive companyId and modelId, and a valid vehicleNumber");
    try {
        const result = await updateUserVehicle({ ...details, userId: req.auth.userId }); const error = saveError(res, result); if (error) return error;
        return sendResponse(res, 200, "Vehicle updated successfully", await getUserVehicleById(req.auth.userId, vehicleId));
    } catch (error) { return next(error); }
};
export const makeMyVehiclePrimary = async (req, res, next) => {
    const vehicleId = idOf(req.params.vehicleId); if (!vehicleId) return sendResponse(res, 400, "Vehicle ID must be a positive integer");
    try {
        if (!(await setPrimaryUserVehicle(req.auth.userId, vehicleId))) return sendResponse(res, 404, "Vehicle not found");
        return sendResponse(res, 200, "Primary vehicle updated successfully", await getUserVehicleById(req.auth.userId, vehicleId));
    } catch (error) { return next(error); }
};
export const removeMyVehicle = async (req, res, next) => {
    const vehicleId = idOf(req.params.vehicleId); if (!vehicleId) return sendResponse(res, 400, "Vehicle ID must be a positive integer");
    try {
        if (!(await deleteUserVehicle(req.auth.userId, vehicleId))) return sendResponse(res, 404, "Vehicle not found");
        return sendResponse(res, 200, "Vehicle deleted successfully");
    } catch (error) { return next(error); }
};
export const getBookingOptions = async (req, res, next) => {
    const serviceId = idOf(req.query.serviceId); if (!serviceId) return sendResponse(res, 400, "serviceId query parameter is required");
    try {
        const data = await getBookingStartData(req.auth.userId, serviceId);
        if (data.status === "vehicle_required") return sendResponse(res, 409, "Please add a vehicle before booking a service", { code: "VEHICLE_DETAILS_REQUIRED" });
        if (data.status === "service_not_available") return sendResponse(res, 400, "Selected service is disabled or is not available for the primary vehicle");
        return sendResponse(res, 200, "Booking options fetched successfully", data);
    } catch (error) { return next(error); }
};
