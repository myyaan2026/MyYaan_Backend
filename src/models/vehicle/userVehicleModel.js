import pool from "../../config/db.js";

const catalogForType = (type) => type.includes("BIKE")
    ? { companies: "bike_companies", companyId: "bike_company_id", models: "bike_models", modelId: "bike_model_id" }
    : { companies: "car_companies", companyId: "car_company_id", models: "car_models", modelId: "car_model_id" };
const categoryForType = (type) => type.includes("BIKE") ? "BIKE" : "CAR";
const vehicleFields = ({ vehicleType, companyId, modelId }) => vehicleType.includes("BIKE")
    ? [companyId, modelId, null, null] : [null, null, companyId, modelId];

const vehicleSelect = `SELECT detail.vehicle_id AS "vehicleId", detail.vehicle_type AS "vehicleType",
    detail.vehicle_number AS "vehicleNumber", detail.is_primary AS "isPrimary",
    COALESCE(bikeCompany.company_name, carCompany.company_name) AS "companyName",
    COALESCE(bikeModel.model_name, carModel.model_name) AS "modelName",
    COALESCE(detail.bike_company_id, detail.car_company_id) AS "companyId",
    COALESCE(detail.bike_model_id, detail.car_model_id) AS "modelId",
    detail.created_at AS "createdAt", detail.updated_at AS "updatedAt"
    FROM user_vehicle_details detail
    LEFT JOIN bike_companies bikeCompany ON bikeCompany.bike_company_id=detail.bike_company_id
    LEFT JOIN bike_models bikeModel ON bikeModel.bike_model_id=detail.bike_model_id
    LEFT JOIN car_companies carCompany ON carCompany.car_company_id=detail.car_company_id
    LEFT JOIN car_models carModel ON carModel.car_model_id=detail.car_model_id`;

export const getVehicleCompanies = async (vehicleType) => {
    const c = catalogForType(vehicleType);
    const result = await pool.query(`SELECT company.${c.companyId} AS "companyId", company.company_name AS "companyName",
        company.company_short_name AS "companyShortName", company.company_long_name AS "companyLongName"
        FROM ${c.companies} company WHERE company.is_enabled=TRUE AND EXISTS
        (SELECT 1 FROM ${c.models} model WHERE model.${c.companyId}=company.${c.companyId}
         AND model.is_enabled=TRUE AND model.vehicle_type=$1) ORDER BY company.company_name`, [vehicleType]);
    return result.rows;
};

export const getVehicleModels = async (vehicleType, companyId = null) => {
    const c = catalogForType(vehicleType); const values = [vehicleType];
    const filter = companyId ? ` AND model.${c.companyId}=$2` : "";
    if (companyId) values.push(companyId);
    const result = await pool.query(`SELECT model.${c.modelId} AS "modelId", model.model_name AS "modelName",
        model.model_short_name AS "modelShortName", model.model_long_name AS "modelLongName", model.engine_cc AS "engineCc",
        company.${c.companyId} AS "companyId", company.company_name AS "companyName"
        FROM ${c.models} model JOIN ${c.companies} company ON company.${c.companyId}=model.${c.companyId}
        WHERE model.is_enabled=TRUE AND company.is_enabled=TRUE AND model.vehicle_type=$1${filter}
        ORDER BY company.company_name, model.model_name`, values);
    return result.rows;
};

export const getUserVehicles = async (userId) => (await pool.query(
    `${vehicleSelect} WHERE detail.user_id=$1 ORDER BY detail.is_primary DESC, detail.vehicle_id`, [userId]
)).rows;
export const getUserVehicleById = async (userId, vehicleId) => (await pool.query(
    `${vehicleSelect} WHERE detail.user_id=$1 AND detail.vehicle_id=$2`, [userId, vehicleId]
)).rows[0] ?? null;
const getPrimaryVehicle = async (userId) => (await pool.query(
    `${vehicleSelect} WHERE detail.user_id=$1 AND detail.is_primary=TRUE`, [userId]
)).rows[0] ?? null;

const userAndCatalogAreValid = async (client, details) => {
    const user = await client.query("SELECT 1 FROM users WHERE user_id=$1 AND is_verified=TRUE AND is_login_enabled=TRUE FOR UPDATE", [details.userId]);
    if (!user.rowCount) return "user_not_found";
    const c = catalogForType(details.vehicleType);
    const model = await client.query(`SELECT 1 FROM ${c.models} WHERE ${c.modelId}=$1 AND ${c.companyId}=$2
        AND vehicle_type=$3 AND is_enabled=TRUE`, [details.modelId, details.companyId, details.vehicleType]);
    return model.rowCount ? null : "invalid_catalog";
};

export const createUserVehicle = async (details) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const invalid = await userAndCatalogAreValid(client, details);
        if (invalid) { await client.query("ROLLBACK"); return { status: invalid }; }
        const vehicles = await client.query("SELECT vehicle_id FROM user_vehicle_details WHERE user_id=$1 FOR UPDATE", [details.userId]);
        const isPrimary = details.isPrimary || !vehicles.rowCount;
        if (isPrimary) await client.query("UPDATE user_vehicle_details SET is_primary=FALSE,updated_at=CURRENT_TIMESTAMP WHERE user_id=$1", [details.userId]);
        const result = await client.query(`INSERT INTO user_vehicle_details
            (user_id,vehicle_type,bike_company_id,bike_model_id,car_company_id,car_model_id,vehicle_number,is_primary)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING vehicle_id`,
        [details.userId, details.vehicleType, ...vehicleFields(details), details.vehicleNumber, isPrimary]);
        await client.query("COMMIT"); return { status: "created", vehicleId: Number(result.rows[0].vehicle_id) };
    } catch (error) {
        await client.query("ROLLBACK");
        if (error.code === "23505" && error.constraint === "user_vehicle_details_vehicle_number_key") return { status: "vehicle_number_in_use" };
        throw error;
    } finally { client.release(); }
};

export const updateUserVehicle = async (details) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const invalid = await userAndCatalogAreValid(client, details);
        if (invalid) { await client.query("ROLLBACK"); return { status: invalid }; }
        const owned = await client.query("SELECT is_primary FROM user_vehicle_details WHERE user_id=$1 AND vehicle_id=$2 FOR UPDATE", [details.userId, details.vehicleId]);
        if (!owned.rowCount) { await client.query("ROLLBACK"); return { status: "not_found" }; }
        const isPrimary = details.isPrimary === true ? true : owned.rows[0].is_primary;
        if (isPrimary) await client.query("UPDATE user_vehicle_details SET is_primary=FALSE,updated_at=CURRENT_TIMESTAMP WHERE user_id=$1", [details.userId]);
        await client.query(`UPDATE user_vehicle_details SET vehicle_type=$3,bike_company_id=$4,bike_model_id=$5,
            car_company_id=$6,car_model_id=$7,vehicle_number=$8,is_primary=$9,updated_at=CURRENT_TIMESTAMP
            WHERE user_id=$1 AND vehicle_id=$2`,
        [details.userId, details.vehicleId, details.vehicleType, ...vehicleFields(details), details.vehicleNumber, isPrimary]);
        await client.query("COMMIT"); return { status: "saved" };
    } catch (error) {
        await client.query("ROLLBACK");
        if (error.code === "23505" && error.constraint === "user_vehicle_details_vehicle_number_key") return { status: "vehicle_number_in_use" };
        throw error;
    } finally { client.release(); }
};

export const setPrimaryUserVehicle = async (userId, vehicleId) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const owned = await client.query("SELECT 1 FROM user_vehicle_details WHERE user_id=$1 AND vehicle_id=$2 FOR UPDATE", [userId, vehicleId]);
        if (!owned.rowCount) { await client.query("ROLLBACK"); return false; }
        await client.query("UPDATE user_vehicle_details SET is_primary=(vehicle_id=$2),updated_at=CURRENT_TIMESTAMP WHERE user_id=$1", [userId, vehicleId]);
        await client.query("COMMIT"); return true;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
};

export const deleteUserVehicle = async (userId, vehicleId) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const vehicle = await client.query("SELECT is_primary FROM user_vehicle_details WHERE user_id=$1 AND vehicle_id=$2 FOR UPDATE", [userId, vehicleId]);
        if (!vehicle.rowCount) { await client.query("ROLLBACK"); return false; }
        await client.query("DELETE FROM user_vehicle_details WHERE user_id=$1 AND vehicle_id=$2", [userId, vehicleId]);
        if (vehicle.rows[0].is_primary) await client.query(`UPDATE user_vehicle_details SET is_primary=TRUE,updated_at=CURRENT_TIMESTAMP
            WHERE vehicle_id=(SELECT vehicle_id FROM user_vehicle_details WHERE user_id=$1 ORDER BY created_at,vehicle_id LIMIT 1)`, [userId]);
        await client.query("COMMIT"); return true;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
};

export const getBookingStartData = async (userId, serviceId) => {
    const primaryVehicle = await getPrimaryVehicle(userId);
    if (!primaryVehicle) return { status: "vehicle_required" };
    const service = await pool.query(`SELECT service_id::INTEGER AS "serviceId",service_code AS "serviceCode",
        service_name AS "serviceName",service_type AS "serviceType" FROM service_types
        WHERE service_id=$1 AND is_enabled=TRUE AND vehicle_category=$2`, [serviceId, categoryForType(primaryVehicle.vehicleType)]);
    if (!service.rowCount) return { status: "service_not_available" };
    const subServices = await pool.query(`SELECT sub_service_id::INTEGER AS "subServiceId",sub_service_code AS "subServiceCode",
        sub_service_name AS "subServiceName",sub_service_description AS "subServiceDescription",is_enabled AS "isEnabled"
        FROM service_sub_types WHERE service_id=$1 AND is_enabled=TRUE ORDER BY sub_service_name`, [serviceId]);
    return { status: "ok", primaryVehicle, service: service.rows[0], subServices: subServices.rows };
};
