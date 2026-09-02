import pool from "../config/db.js";

export const revokeAuthSession = async (sessionId, userId) => {
    await pool.query(
        `UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP
         WHERE session_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
        [sessionId, userId]
    );
};

