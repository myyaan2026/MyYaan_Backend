import pool from "../config/db.js";

export const findOrCreateUserByMobile = async (mobile) => {
    const result = await pool.query(
        `INSERT INTO users (mobile)
         VALUES ($1)
         ON CONFLICT (mobile) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id, mobile, is_mobile_verified, created_at`,
        [mobile]
    );
    return result.rows[0];
};

export const createOtp = async (userId, mobile, otpHash, expiresAt) => {
    await pool.query(
        `UPDATE otp_codes SET expires_at = CURRENT_TIMESTAMP
         WHERE mobile = $1 AND verified_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
        [mobile]
    );
    const result = await pool.query(
        `INSERT INTO otp_codes (user_id, mobile, otp_hash, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id, expires_at`,
        [userId, mobile, otpHash, expiresAt]
    );
    return result.rows[0];
};

export const verifyLatestOtp = async (mobile, otpHash) => {
    const result = await pool.query(
        `UPDATE otp_codes SET verified_at = CURRENT_TIMESTAMP
         WHERE id = (
             SELECT id FROM otp_codes
             WHERE mobile = $1 AND otp_hash = $2 AND verified_at IS NULL
               AND expires_at > CURRENT_TIMESTAMP
             ORDER BY created_at DESC LIMIT 1
         ) RETURNING user_id`,
        [mobile, otpHash]
    );
    return result.rows[0] ?? null;
};

export const markUserMobileVerified = async (userId) => {
    const result = await pool.query(
        `UPDATE users SET is_mobile_verified = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, mobile, is_mobile_verified, created_at, updated_at`,
        [userId]
    );
    return result.rows[0];
};

export const getUserByIdService = async (id) => {
    const result = await pool.query(
        `SELECT id, mobile, is_mobile_verified, created_at, updated_at
         FROM users WHERE id = $1`,
        [id]
    );
    return result.rows[0] ?? null;
};
