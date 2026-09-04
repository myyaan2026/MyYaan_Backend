import pool from "../config/db.js";

export const revokeAuthSession = async (sessionId, userId) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const session = await client.query(
            `UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP
             WHERE session_id = $1 AND user_id = $2 AND revoked_at IS NULL
             RETURNING device_id`,
            [sessionId, userId]
        );
        const deviceId = session.rows[0]?.device_id;
        if (deviceId) {
            await client.query(
                `UPDATE user_device_details
                 SET is_active = FALSE, push_token = NULL, push_provider = NULL,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE device_id = $1 AND user_id = $2`,
                [deviceId, userId]
            );
        }
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
