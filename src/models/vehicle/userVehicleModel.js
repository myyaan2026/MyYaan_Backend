import pool from "../../config/db.js";

const catalogForType = (vehicleType) => {
    if (vehicleType === "BIKE" || vehicleType === "ELECTRIC_BIKE") {
        return { companyTable: "bike_companies", companyId: "bike_company_id", modelTable: "bike_models", modelId: "bike_model_id" };
    }
    return { companyTable: "car_companies", companyId: "car_company_id", modelTable: "car_models", modelId: "car_model_id" };
};

export const getVehicleCompanies = async (vehicleType) => {
    const catalog = catalogForType(vehicleType);
    const result = await pool.query(
        `SELECT company.${catalog.companyId} AS "companyId", company.company_name AS "companyName",
                company.company_short_name AS "companyShortName", company.company_long_name AS "companyLongName"
         FROM ${catalog.companyTable} company
         WHERE company.is_enabled = TRUE
           AND EXISTS (SELECT 1 FROM ${catalog.modelTable} model
                       WHERE model.${catalog.companyId} = company.${catalog.companyId}
                         AND model.is_enabled = TRUE AND model.vehicle_type = $1)
         ORDER BY company.company_name`,
        [vehicleType]
    );
    return result.rows;
};

export const getVehicleModels = async (vehicleType, companyId = null) => {
    const catalog = catalogForType(vehicleType);
    const params = [vehicleType];
    const companyFilter = companyId ? ` AND model.${catalog.companyId} = $2` : "";
    if (companyId) params.push(companyId);
    const result = await pool.query(
        `SELECT model.${catalog.modelId} AS "modelId", model.model_name AS "modelName",
                model.model_short_name AS "modelShortName", model.model_long_name AS "modelLongName",
                model.engine_cc AS "engineCc", company.${catalog.companyId} AS "companyId",
                company.company_name AS "companyName"
         FROM ${catalog.modelTable} model
         JOIN ${catalog.companyTable} company ON company.${catalog.companyId} = model.${catalog.companyId}
         WHERE model.is_enabled = TRUE AND company.is_enabled = TRUE
           AND model.vehicle_type = $1${companyFilter}
         ORDER BY company.company_name, model.model_name`,
        params
    );
    return result.rows;
};

export const getUserVehicleDetails = async (userId) => {
    const result = await pool.query(
        `SELECT detail.vehicle_type AS "vehicleType", detail.vehicle_number AS "vehicleNumber",
                COALESCE(bikeCompany.company_name, carCompany.company_name) AS "companyName",
                COALESCE(bikeModel.model_name, carModel.model_name) AS "modelName",
                COALESCE(detail.bike_company_id, detail.car_company_id) AS "companyId",
                COALESCE(detail.bike_model_id, detail.car_model_id) AS "modelId",
                detail.created_at AS "createdAt", detail.updated_at AS "updatedAt"
         FROM user_vehicle_details detail
         LEFT JOIN bike_companies bikeCompany ON bikeCompany.bike_company_id = detail.bike_company_id
         LEFT JOIN bike_models bikeModel ON bikeModel.bike_model_id = detail.bike_model_id
         LEFT JOIN car_companies carCompany ON carCompany.car_company_id = detail.car_company_id
         LEFT JOIN car_models carModel ON carModel.car_model_id = detail.car_model_id
         WHERE detail.user_id = $1`,
        [userId]
    );
    return result.rows[0] ?? null;
};

export const saveUserVehicleDetails = async ({ userId, vehicleType, companyId, modelId, vehicleNumber }) => {
    const catalog = catalogForType(vehicleType);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const model = await client.query(
            `SELECT 1 FROM ${catalog.modelTable}
             WHERE ${catalog.modelId} = $1 AND ${catalog.companyId} = $2
               AND vehicle_type = $3 AND is_enabled = TRUE`,
            [modelId, companyId, vehicleType]
        );
        if (!model.rowCount) {
            await client.query("ROLLBACK");
            return { status: "invalid_catalog" };
        }
        const user = await client.query(
            "SELECT 1 FROM users WHERE user_id = $1 AND is_verified = TRUE AND is_login_enabled = TRUE",
            [userId]
        );
        if (!user.rowCount) {
            await client.query("ROLLBACK");
            return { status: "user_not_found" };
        }
        const bikeValues = vehicleType.includes("BIKE") ? [companyId, modelId] : [null, null];
        const carValues = vehicleType.includes("CAR") ? [companyId, modelId] : [null, null];
        const result = await client.query(
            `INSERT INTO user_vehicle_details
                (user_id, vehicle_type, bike_company_id, bike_model_id, car_company_id, car_model_id, vehicle_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id) DO UPDATE SET
                vehicle_type = EXCLUDED.vehicle_type, bike_company_id = EXCLUDED.bike_company_id,
                bike_model_id = EXCLUDED.bike_model_id, car_company_id = EXCLUDED.car_company_id,
                car_model_id = EXCLUDED.car_model_id, vehicle_number = EXCLUDED.vehicle_number,
                updated_at = CURRENT_TIMESTAMP
             RETURNING user_id`,
            [userId, vehicleType, ...bikeValues, ...carValues, vehicleNumber]
        );
        await client.query("COMMIT");
        return { status: "saved", userId: result.rows[0].user_id };
    } catch (error) {
        await client.query("ROLLBACK");
        if (error.code === "23505" && error.constraint === "user_vehicle_details_vehicle_number_key") {
            return { status: "vehicle_number_in_use" };
        }
        throw error;
    } finally {
        client.release();
    }
};
