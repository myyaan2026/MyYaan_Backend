import { findAvailableServicePartners } from "../../../../models/user/service/discovery/servicePartnerDiscoveryModel.js";
import { sendResponse } from "../../../../utils/response.js";

const positiveId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const coordinate = (value, min, max) => Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max ? Number(value) : null;
const radius = (value) => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 500 ? Number(value) : null;

export const listNearbyServicePartners = async (req, res, next) => {
    const vehicleId = positiveId(req.query.vehicleId);
    const serviceId = positiveId(req.query.serviceId);
    const subServiceId = positiveId(req.query.subServiceId);
    const serviceOptionId = req.query.serviceOptionId ? positiveId(req.query.serviceOptionId) : null;
    const latitude = coordinate(req.query.latitude, -90, 90);
    const longitude = coordinate(req.query.longitude, -180, 180);
    const distanceKm = radius(req.query.distanceKm);
    if (!vehicleId || !serviceId || !subServiceId || latitude === null || longitude === null || !distanceKm) {
        return sendResponse(res, 400, "Provide vehicleId, serviceId, subServiceId, valid latitude/longitude, and distanceKm (0–500)");
    }
    if (req.query.serviceOptionId && !serviceOptionId) {
        return sendResponse(res, 400, "serviceOptionId must be a positive integer");
    }
    try {
        const data = await findAvailableServicePartners({
            userId: req.auth.userId,
            vehicleId,
            serviceId,
            subServiceId,
            serviceOptionId,
            latitude,
            longitude,
            distanceKm
        });
        if (data.status === "vehicle_not_found") return sendResponse(res, 404, "Selected vehicle not found");
        if (data.status === "service_not_available") return sendResponse(res, 400, "Selected service is not available for this vehicle");
        if (data.status === "sub_service_not_available") return sendResponse(res, 400, "Selected sub-service is not available");
        return sendResponse(res, 200, "Nearby service partners fetched successfully", data);
    } catch (error) { return next(error); }
};
