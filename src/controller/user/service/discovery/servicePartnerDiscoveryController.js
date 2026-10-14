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
    const addressId = req.query.addressId ? positiveId(req.query.addressId) : null;
    const latitude = req.query.latitude !== undefined && req.query.latitude !== null && req.query.latitude !== ""
        ? coordinate(req.query.latitude, -90, 90)
        : null;
    const longitude = req.query.longitude !== undefined && req.query.longitude !== null && req.query.longitude !== ""
        ? coordinate(req.query.longitude, -180, 180)
        : null;
    const distanceKm = radius(req.query.distanceKm) ?? 15;

    if (!vehicleId || !serviceId || !subServiceId) {
        return sendResponse(res, 400, "vehicleId, serviceId, and subServiceId query parameters are required");
    }
    if (req.query.serviceOptionId && !serviceOptionId) {
        return sendResponse(res, 400, "serviceOptionId must be a positive integer");
    }
    if (req.query.addressId && !addressId) {
        return sendResponse(res, 400, "addressId must be a positive integer");
    }
    if ((req.query.latitude !== undefined || req.query.longitude !== undefined) && (latitude === null || longitude === null)) {
        return sendResponse(res, 400, "Latitude (-90 to 90) and longitude (-180 to 180) must both be valid coordinates");
    }

    try {
        const data = await findAvailableServicePartners({
            userId: req.auth.userId,
            vehicleId,
            serviceId,
            subServiceId,
            serviceOptionId,
            addressId,
            latitude,
            longitude,
            distanceKm,
        });
        if (data.status === "vehicle_not_found") return sendResponse(res, 404, "Selected vehicle not found");
        if (data.status === "service_not_available") return sendResponse(res, 400, "Selected service is not available for this vehicle");
        if (data.status === "sub_service_not_available") return sendResponse(res, 400, "Selected sub-service is not available");
        if (data.status === "address_not_found") return sendResponse(res, 404, "Selected address not found");
        if (data.status === "address_invalid_coordinates") {
            return sendResponse(res, 400, "Selected address does not have valid latitude/longitude coordinates");
        }
        if (data.status === "address_required") {
            return sendResponse(res, 400, "Please select an address or provide addressId for Home Service / Pick & Drop");
        }
        if (data.status === "coordinates_required") {
            return sendResponse(res, 400, "Provide valid latitude and longitude coordinates for Walk In service");
        }
        return sendResponse(res, 200, "Nearby service partners fetched successfully", data);
    } catch (error) { return next(error); }
};
