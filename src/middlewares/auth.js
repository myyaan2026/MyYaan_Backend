import crypto from "node:crypto";
import pool from "../config/db.js";
import { sendResponse } from "../utils/response.js";

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export const authenticate = async (req, res, next) => {
    const authorization = String(req.headers.authorization ?? "");
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) return sendResponse(res, 401, "Bearer token is required");

    try {
        const result = await pool.query(
            `UPDATE auth_sessions session SET last_used_at = CURRENT_TIMESTAMP
             FROM users JOIN roles ON roles.role_id = users.role_id
             WHERE session.user_id = users.user_id
               AND session.token_hash = $1
               AND session.revoked_at IS NULL
               AND session.expires_at > CURRENT_TIMESTAMP
               AND users.is_verified = TRUE
               AND users.is_login_enabled = TRUE
             RETURNING session.session_id, users.user_id, roles.code AS role, session.expires_at`,
            [hashToken(match[1].trim())]
        );
        if (!result.rowCount) return sendResponse(res, 401, "Bearer token is invalid or expired");
        req.auth = {
            sessionId: Number(result.rows[0].session_id),
            userId: Number(result.rows[0].user_id),
            role: result.rows[0].role,
            expiresAt: result.rows[0].expires_at,
        };
        return next();
    } catch (error) {
        return next(error);
    }
};

export const requireRole = (role) => (req, res, next) => {
    if (req.auth?.role !== role) return sendResponse(res, 403, "You are not allowed to access this resource");
    return next();
};
