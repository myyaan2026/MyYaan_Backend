import pool from "../config/db.js";

export const getAppUpdateConfig = async (deviceType) => {
    const result = await pool.query(
        `SELECT device_type AS "deviceType",
                minimum_supported_version AS "minimumSupportedVersion",
                latest_version AS "latestVersion",
                minimum_supported_build AS "minimumSupportedBuild",
                latest_build AS "latestBuild",
                force_update_enabled AS "forceUpdateEnabled",
                store_url AS "storeUrl", update_message AS "updateMessage"
         FROM app_update_config WHERE device_type = $1`,
        [deviceType]
    );
    return result.rows[0] ?? null;
};

