import pool from "../../../../config/db.js";
import { getUserVehicleById } from "../../../vehicle/userVehicleModel.js";

const categoryForVehicle = (vehicleType) => vehicleType.includes("BIKE") ? "BIKE" : "CAR";

export const findAvailableServicePartners = async ({ userId, vehicleId, serviceId, subServiceId, latitude, longitude, distanceKm }) => {
    const vehicle = await getUserVehicleById(userId, vehicleId);
    if (!vehicle) return { status: "vehicle_not_found" };
    const category = categoryForVehicle(vehicle.vehicleType);
    const service = await pool.query(
        `SELECT 1 FROM service_types WHERE service_id=$1 AND is_enabled=TRUE
         AND vehicle_category IN ($2, 'ANY')`, [serviceId, category]
    );
    if (!service.rowCount) return { status: "service_not_available" };
    const subService = await pool.query(
        "SELECT 1 FROM service_sub_types WHERE sub_service_id=$1 AND service_id=$2 AND is_enabled=TRUE",
        [subServiceId, serviceId]
    );
    if (!subService.rowCount) return { status: "sub_service_not_available" };

    const supportTable = category === "BIKE" ? "service_center_bike_models" : "service_center_car_models";
    const modelColumn = category === "BIKE" ? "bike_model_id" : "car_model_id";
    const result = await pool.query(
        `WITH eligible_centers AS (
            SELECT center.service_center_id, center.service_center_name, center.service_center_pic_url,
                   center.address_line_1, center.address_line_2, center.city, center.state, center.pincode,
                   center.latitude, center.longitude,
                   6371 * acos(LEAST(1.0, GREATEST(-1.0,
                       cos(radians($1)) * cos(radians(center.latitude)) *
                       cos(radians(center.longitude) - radians($2)) +
                       sin(radians($1)) * sin(radians(center.latitude))
                   ))) AS distance_km
            FROM service_centers center
            JOIN service_center_services offered
              ON offered.service_center_id=center.service_center_id AND offered.service_type_id=$3
            JOIN service_center_sub_services delivery
              ON delivery.service_center_id=center.service_center_id
             AND delivery.service_id=$3 AND delivery.sub_service_id=$4
            WHERE center.is_active=TRUE AND center.latitude IS NOT NULL AND center.longitude IS NOT NULL
              AND (
                  NOT EXISTS (SELECT 1 FROM ${supportTable} configured
                              WHERE configured.service_center_id=center.service_center_id AND configured.service_id=$3)
                  OR EXISTS (SELECT 1 FROM ${supportTable} supported
                             WHERE supported.service_center_id=center.service_center_id
                               AND supported.service_id=$3 AND supported.${modelColumn}=$5)
              )
        )
         SELECT service_center_id::INTEGER AS "serviceCenterId", service_center_name AS "serviceCenterName",
                service_center_pic_url AS "serviceCenterPicUrl", address_line_1 AS "addressLine1",
                address_line_2 AS "addressLine2", city, state, pincode, latitude, longitude,
                ROUND(distance_km::numeric, 2) AS "distanceKm"
         FROM eligible_centers WHERE distance_km <= $6
         ORDER BY distance_km, service_center_name`,
        [latitude, longitude, serviceId, subServiceId, vehicle.modelId, distanceKm]
    );
    return { status: "ok", selectedVehicle: vehicle, partners: result.rows };
};
