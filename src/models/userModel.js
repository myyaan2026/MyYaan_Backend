import pool from "../config/db.js";

const userSelect = `
    SELECT users.id, users.mobile, roles.code AS role,
           users.email, users.name, users.service_center_name,
           users.address_line_1, users.address_line_2, users.city,
           users.pincode, users.latitude, users.longitude,
           users.is_verified AS "isVerified",
           users.is_login_enabled AS "isLoginEnable",
           users.is_profile_updated AS "isProfileUpdate",
           users.created_at, users.updated_at
    FROM users JOIN roles ON roles.id = users.role_id`;

export const createOtp = async (mobile, roleCode, otpHash, expiresAt) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const userResult = await client.query(
            `INSERT INTO users (mobile, role_id)
             VALUES ($1, (SELECT id FROM roles WHERE code = $2))
             ON CONFLICT (mobile, role_id) DO UPDATE SET mobile = EXCLUDED.mobile
             RETURNING id, is_login_enabled`,
            [mobile, roleCode]
        );
        const user = userResult.rows[0];
        if (!user.is_login_enabled) {
            await client.query("ROLLBACK");
            return { isLoginDisabled: true };
        }

        const otpResult = await client.query(
            `INSERT INTO otp_codes
                (user_id, mobile, role_id, otp_hash, expires_at, verified_at, created_at)
             VALUES ($1, $2, (SELECT id FROM roles WHERE code = $3), $4, $5, NULL, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id) DO UPDATE SET
                mobile = EXCLUDED.mobile, role_id = EXCLUDED.role_id,
                otp_hash = EXCLUDED.otp_hash, expires_at = EXCLUDED.expires_at,
                verified_at = NULL, created_at = CURRENT_TIMESTAMP
             RETURNING id, user_id, expires_at`,
            [user.id, mobile, roleCode, otpHash, expiresAt]
        );
        await client.query("COMMIT");
        return otpResult.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

export const verifyOtp = async (mobile, roleCode, otpHash) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const otpResult = await client.query(
            `UPDATE otp_codes AS otp SET verified_at = CURRENT_TIMESTAMP
             FROM users
             WHERE otp.user_id = users.id
               AND users.mobile = $1
               AND users.role_id = (SELECT id FROM roles WHERE code = $2)
               AND users.is_login_enabled = TRUE
               AND otp.otp_hash = $3 AND otp.verified_at IS NULL
               AND otp.expires_at > CURRENT_TIMESTAMP
             RETURNING users.id`,
            [mobile, roleCode, otpHash]
        );
        if (!otpResult.rows[0]) {
            await client.query("ROLLBACK");
            return null;
        }

        await client.query(
            `UPDATE users SET is_verified = TRUE, is_mobile_verified = TRUE,
                    updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [otpResult.rows[0].id]
        );
        const userResult = await client.query(`${userSelect} WHERE users.id = $1`, [otpResult.rows[0].id]);
        await client.query("COMMIT");
        return userResult.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

export const getUserByIdService = async (id) => {
    const result = await pool.query(`${userSelect} WHERE users.id = $1`, [id]);
    return result.rows[0] ?? null;
};
