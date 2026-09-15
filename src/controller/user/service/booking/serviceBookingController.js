import { getBookingStartData } from "../../../../models/user/service/booking/serviceBookingModel.js";
import { sendResponse } from "../../../../utils/response.js";

const serviceIdOf = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;

export const getBookingOptions = async (req, res, next) => {
    const serviceId = serviceIdOf(req.query.serviceId);
    if (!serviceId) return sendResponse(res, 400, "serviceId query parameter is required");
    const vehicleId = req.query.vehicleId === undefined ? null : serviceIdOf(req.query.vehicleId);
    if (req.query.vehicleId !== undefined && !vehicleId) return sendResponse(res, 400, "vehicleId must be a positive integer");
    try {
        const data = await getBookingStartData(req.auth.userId, serviceId, vehicleId);
        if (data.status === "vehicle_required") {
            return sendResponse(res, 409, "Please add a vehicle before booking a service", { code: "VEHICLE_DETAILS_REQUIRED" });
        }
        if (data.status === "service_not_available") {
            return sendResponse(res, 400, "Selected service is disabled or is not available for the selected vehicle");
        }
        if (data.status === "vehicle_not_found") return sendResponse(res, 404, "Selected vehicle not found");
        return sendResponse(res, 200, "Booking options fetched successfully", data);
    } catch (error) {
        return next(error);
    }
};
