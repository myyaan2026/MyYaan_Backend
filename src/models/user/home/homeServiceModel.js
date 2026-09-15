import pool from "../../../config/db.js";

export const getHomeServices = async () => {
    const result = await pool.query(
        `SELECT service_id::INTEGER AS "serviceId", service_code AS "serviceCode",
                service_name AS "serviceName", service_description AS "serviceDescription",
                service_type AS "serviceType", vehicle_category AS "vehicleCategory",
                is_home_enabled AS "isHomeEnabled", home_display_order AS "displayOrder"
         FROM service_types WHERE is_enabled=TRUE AND is_home_enabled=TRUE
         ORDER BY home_display_order NULLS LAST, service_name`
    );
    return result.rows;
};
