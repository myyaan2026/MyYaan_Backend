import pool from "../config/db.js";

export const upsertUserDevice = async ({
    userId,
    sessionId,
    deviceToken,
    deviceType,
    deviceName,
    appVersion,
    buildNumber,
    pushToken,
    pushProvider,
    notificationsEnabled,
}) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const existingDevice = await client.query(
            `SELECT device_id, user_id FROM user_device_details
             WHERE device_token = $1 FOR UPDATE`,
            [deviceToken]
        );

        // If an app installation changes account, invalidate sessions belonging
        // to the previous account on that installation.
        if (existingDevice.rows[0] && Number(existingDevice.rows[0].user_id) !== userId) {
            await client.query(
                `UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP
                 WHERE device_id = $1 AND revoked_at IS NULL`,
                [existingDevice.rows[0].device_id]
            );
        }

        if (pushToken) {
            await client.query(
                `UPDATE user_device_details
                 SET push_token = NULL, push_provider = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE push_token = $1 AND device_token <> $2`,
                [pushToken, deviceToken]
            );
        }

        const result = await client.query(
            `INSERT INTO user_device_details
                (user_id, device_token, device_type, device_name, app_version,
                 build_number, push_token, push_provider, notifications_enabled)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (device_token) DO UPDATE SET
                user_id = EXCLUDED.user_id,
                device_type = EXCLUDED.device_type,
                device_name = EXCLUDED.device_name,
                app_version = EXCLUDED.app_version,
                build_number = EXCLUDED.build_number,
                push_token = EXCLUDED.push_token,
                push_provider = EXCLUDED.push_provider,
                notifications_enabled = EXCLUDED.notifications_enabled,
                is_active = TRUE,
                last_seen_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
             RETURNING device_id AS "deviceId", user_id AS "userId",
                       device_token AS "deviceToken", device_type AS "deviceType",
                       device_name AS "deviceName", app_version AS "appVersion",
                       build_number AS "buildNumber", push_provider AS "pushProvider",
                       notifications_enabled AS "notificationsEnabled",
                       is_active AS "isActive", last_seen_at AS "lastSeenAt",
                       created_at AS "createdAt", updated_at AS "updatedAt"`,
            [
                userId,
                deviceToken,
                deviceType,
                deviceName,
                appVersion,
                buildNumber,
                pushToken,
                pushProvider,
                notificationsEnabled,
            ]
        );

        // Keep one current login session per installation while allowing the
        // same user to remain logged in on any number of different devices.
        await client.query(
            `UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP
             WHERE device_id = $1 AND session_id <> $2 AND revoked_at IS NULL`,
            [result.rows[0].deviceId, sessionId]
        );
        await client.query(
            `UPDATE auth_sessions SET device_id = $1
             WHERE session_id = $2 AND user_id = $3 AND revoked_at IS NULL`,
            [result.rows[0].deviceId, sessionId, userId]
        );
        await client.query("COMMIT");
        return result.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
