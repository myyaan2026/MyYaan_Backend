import pool from "../../config/db.js";

export const getUserProfile = async (userId) => {
    const result = await pool.query(
        `SELECT users.user_id AS "userId", users.mobile, roles.code AS role,
                users.is_profile_updated AS "isProfileUpdated",
                profile.profile_pic_url AS "profilePicUrl",
                profile.first_name AS "firstName", profile.last_name AS "lastName",
                profile.email, profile.alternative_mobile AS "alternativeMobile",
                COALESCE(profile.is_completed, FALSE) AS "isCompleted"
         FROM users JOIN roles ON roles.role_id = users.role_id
         LEFT JOIN user_profiles profile ON profile.user_id = users.user_id
         WHERE users.user_id = $1`,
        [userId]
    );
    return result.rows[0] ?? null;
};

export const saveUserProfile = async (details) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const userResult = await client.query(
            `SELECT users.mobile, roles.code AS role
             FROM users JOIN roles ON roles.role_id = users.role_id
             WHERE users.user_id = $1 AND users.is_verified = TRUE
               AND users.is_login_enabled = TRUE FOR UPDATE`,
            [details.userId]
        );
        const user = userResult.rows[0];
        if (!user) {
            await client.query("ROLLBACK");
            return { status: "user_not_found" };
        }
        if (details.alternativeMobile === user.mobile) {
            await client.query("ROLLBACK");
            return { status: "same_mobile" };
        }
        await client.query(
            `INSERT INTO user_profiles
                (user_id, profile_pic_url, first_name, last_name, email,
                 alternative_mobile, is_completed)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE)
             ON CONFLICT (user_id) DO UPDATE SET
                profile_pic_url = EXCLUDED.profile_pic_url,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                email = EXCLUDED.email,
                alternative_mobile = EXCLUDED.alternative_mobile,
                is_completed = TRUE,
                updated_at = CURRENT_TIMESTAMP`,
            [details.userId, details.profilePicUrl, details.firstName,
                details.lastName, details.email, details.alternativeMobile]
        );
        if (user.role === "service_partner") {
            await client.query(
                `INSERT INTO service_partner_onboarding
                    (user_id, is_personal_details_completed)
                 VALUES ($1, TRUE)
                 ON CONFLICT (user_id) DO UPDATE SET
                    is_personal_details_completed = TRUE,
                    updated_at = CURRENT_TIMESTAMP`,
                [details.userId]
            );
            await client.query(
                `UPDATE users SET is_profile_updated = onboarding.is_personal_details_completed
                        AND onboarding.is_service_center_details_completed
                        AND onboarding.is_services_completed,
                        updated_at = CURRENT_TIMESTAMP
                 FROM service_partner_onboarding onboarding
                 WHERE users.user_id = onboarding.user_id AND users.user_id = $1`,
                [details.userId]
            );
        } else {
            await client.query(
                `UPDATE users SET is_profile_updated = TRUE, updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1`,
                [details.userId]
            );
        }
        await client.query("COMMIT");
        return { status: "saved" };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

