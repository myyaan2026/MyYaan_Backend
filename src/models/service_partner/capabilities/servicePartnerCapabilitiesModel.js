import pool from "../../../config/db.js";

const catalogForType = (vehicleType) => vehicleType.includes("BIKE")
    ? { modelTable: "bike_models", modelId: "bike_model_id", companyId: "bike_company_id", companyTable: "service_center_bike_companies", supportTable: "service_center_bike_models" }
    : { modelTable: "car_models", modelId: "car_model_id", companyId: "car_company_id", companyTable: "service_center_car_companies", supportTable: "service_center_car_models" };

const ownedOfferedCenter = async (client, userId, serviceCenterId, serviceId) => {
    const result = await client.query(
        `SELECT 1 FROM service_centers center JOIN service_center_services service
           ON service.service_center_id=center.service_center_id AND service.service_type_id=$3
         WHERE center.user_id=$1 AND center.service_center_id=$2 AND center.is_active=TRUE FOR UPDATE`,
        [userId, serviceCenterId, serviceId]
    );
    return result.rowCount > 0;
};

export const getPartnerSubServices = async (userId, serviceCenterId, serviceId) => {
    const result = await pool.query(
        `SELECT sub.sub_service_id::INTEGER AS "subServiceId", sub.sub_service_code AS "subServiceCode",
                sub.sub_service_name AS "subServiceName", sub.sub_service_description AS "subServiceDescription",
                sub.is_enabled AS "isEnabled", EXISTS (
                    SELECT 1 FROM service_center_sub_services selected
                    WHERE selected.service_center_id=$1 AND selected.service_id=$2 AND selected.sub_service_id=sub.sub_service_id
                ) AS "isSelected"
         FROM service_centers center JOIN service_center_services offered
           ON offered.service_center_id=center.service_center_id AND offered.service_type_id=$2
         JOIN service_sub_types sub ON sub.service_id=$2
         WHERE center.user_id=$3 AND center.service_center_id=$1 AND center.is_active=TRUE
         ORDER BY sub.sub_service_name`, [serviceCenterId, serviceId, userId]
    );
    return result.rows;
};

export const savePartnerSubServices = async ({ userId, serviceCenterId, serviceId, subServiceIds }) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        if (!(await ownedOfferedCenter(client, userId, serviceCenterId, serviceId))) { await client.query("ROLLBACK"); return "center_or_service_not_found"; }
        const valid = await client.query("SELECT sub_service_id FROM service_sub_types WHERE service_id=$1 AND is_enabled=TRUE AND sub_service_id=ANY($2::int[])", [serviceId, subServiceIds]);
        if (valid.rowCount !== subServiceIds.length) { await client.query("ROLLBACK"); return "invalid_sub_services"; }
        await client.query("DELETE FROM service_center_sub_services WHERE service_center_id=$1 AND service_id=$2", [serviceCenterId, serviceId]);
        await client.query("INSERT INTO service_center_sub_services(service_center_id,service_id,sub_service_id) SELECT $1,$2,unnest($3::int[])", [serviceCenterId, serviceId, subServiceIds]);
        await client.query("COMMIT"); return "saved";
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
};

export const getPartnerVehicleSupport = async (userId, serviceCenterId, serviceId, vehicleType) => {
    const c = catalogForType(vehicleType);
    const result = await pool.query(
        `SELECT model.${c.modelId}::INTEGER AS "modelId", model.model_name AS "modelName",
                model.${c.companyId}::INTEGER AS "companyId", company.company_name AS "companyName",
                model.vehicle_type AS "vehicleType" FROM ${c.supportTable} selected
         JOIN service_centers center ON center.service_center_id=selected.service_center_id
         JOIN ${c.modelTable} model ON model.${c.modelId}=selected.${c.modelId}
         JOIN ${vehicleType.includes("BIKE") ? "bike_companies" : "car_companies"} company ON company.${c.companyId}=model.${c.companyId}
         WHERE center.user_id=$1 AND center.service_center_id=$2 AND selected.service_id=$3
         ORDER BY company.company_name, model.model_name`, [userId, serviceCenterId, serviceId]
    );
    return result.rows;
};

export const savePartnerVehicleSupport = async ({ userId, serviceCenterId, serviceId, vehicleType, modelIds }) => {
    const c = catalogForType(vehicleType); const client = await pool.connect();
    try {
        await client.query("BEGIN");
        if (!(await ownedOfferedCenter(client, userId, serviceCenterId, serviceId))) { await client.query("ROLLBACK"); return "center_or_service_not_found"; }
        const models = await client.query(`SELECT ${c.modelId},${c.companyId} FROM ${c.modelTable} WHERE ${c.modelId}=ANY($1::int[]) AND vehicle_type=$2 AND is_enabled=TRUE`, [modelIds, vehicleType]);
        if (models.rowCount !== modelIds.length) { await client.query("ROLLBACK"); return "invalid_models"; }
        await client.query(`DELETE FROM ${c.supportTable} WHERE service_center_id=$1 AND service_id=$2`, [serviceCenterId, serviceId]);
        await client.query(`DELETE FROM ${c.companyTable} WHERE service_center_id=$1 AND service_id=$2`, [serviceCenterId, serviceId]);
        await client.query(`INSERT INTO ${c.companyTable}(service_center_id,service_id,${c.companyId})
            SELECT DISTINCT $1,$2,${c.companyId} FROM ${c.modelTable} WHERE ${c.modelId}=ANY($3::int[])`, [serviceCenterId, serviceId, modelIds]);
        await client.query(`INSERT INTO ${c.supportTable}(service_center_id,service_id,${c.companyId},${c.modelId})
            SELECT $1,$2,${c.companyId},${c.modelId} FROM ${c.modelTable} WHERE ${c.modelId}=ANY($3::int[])`, [serviceCenterId, serviceId, modelIds]);
        await client.query("COMMIT"); return "saved";
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
};
