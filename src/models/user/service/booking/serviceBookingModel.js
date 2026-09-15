import pool from "../../../../config/db.js";
import { getUserVehicleById, getUserVehicles } from "../../../vehicle/userVehicleModel.js";

const categoryForVehicle = (vehicleType) => vehicleType.includes("BIKE") ? "BIKE" : "CAR";

export const getBookingStartData = async (userId, serviceId, vehicleId = null) => {
    const vehicles = await getUserVehicles(userId);
    const primaryVehicle = vehicles.find((vehicle) => vehicle.isPrimary) ?? null;
    if (!primaryVehicle) return { status: "vehicle_required" };
    const selectedVehicle = vehicleId ? await getUserVehicleById(userId, vehicleId) : primaryVehicle;
    if (!selectedVehicle) return { status: "vehicle_not_found" };
    const service = await pool.query(
        `SELECT service_id::INTEGER AS "serviceId", service_code AS "serviceCode",
                service_name AS "serviceName", service_description AS "serviceDescription",
                service_type AS "serviceType", vehicle_category AS "vehicleCategory"
         FROM service_types WHERE service_id=$1 AND is_enabled=TRUE
           AND vehicle_category IN ($2, 'ANY')`,
        [serviceId, categoryForVehicle(selectedVehicle.vehicleType)]
    );
    if (!service.rowCount) return { status: "service_not_available" };
    const [subServices, serviceOptions] = await Promise.all([
        pool.query(`SELECT sub_service_id::INTEGER AS "subServiceId", sub_service_code AS "subServiceCode",
            sub_service_name AS "subServiceName", sub_service_description AS "subServiceDescription",
            is_enabled AS "isEnabled" FROM service_sub_types
            WHERE service_id=$1 AND is_enabled=TRUE ORDER BY sub_service_name`, [serviceId]),
        pool.query(`SELECT service_option_id::INTEGER AS "serviceOptionId", service_option_code AS "serviceOptionCode",
            service_option_name AS "serviceOptionName", service_option_description AS "serviceOptionDescription",
            short_description AS "shortDescription", full_description AS "fullDescription", tags AS "tags",
            checklist AS "checklist", base_price AS "basePrice", additional_charge_note AS "additionalChargeNote",
            estimated_duration_minutes AS "estimatedDurationMinutes", warranty_description AS "warrantyDescription",
            vehicle_category AS "vehicleCategory", is_enabled AS "isEnabled", is_default AS "isDefaultSelected",
            display_order AS "displayOrder" FROM service_options
            WHERE service_id=$1 AND is_enabled=TRUE AND vehicle_category IN ($2, 'ANY')
            ORDER BY is_default DESC, display_order, service_option_name`, [serviceId, categoryForVehicle(selectedVehicle.vehicleType)]),
    ]);
    return {
        status: "ok",
        primaryVehicle,
        selectedVehicle,
        vehicles,
        service: service.rows[0],
        subServices: subServices.rows,
        serviceOptions: serviceOptions.rows,
    };
};
