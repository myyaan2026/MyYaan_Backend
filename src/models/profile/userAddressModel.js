import pool from "../../config/db.js";

const addressSelect = `SELECT address_id::INTEGER AS "addressId",
    tag, tag_details AS "tagDetails",
    house_number AS "houseNumber",
    address_line_1 AS "addressLine1",
    address_line_2 AS "addressLine2",
    landmark,
    city, state, pincode,
    latitude::FLOAT AS latitude,
    longitude::FLOAT AS longitude,
    is_default AS "isPrimary",
    is_default AS "isDefault",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
    FROM user_addresses`;

export const getUserAddresses = async (userId) => {
    const result = await pool.query(
        `${addressSelect} WHERE user_id = $1 AND is_active = TRUE
         ORDER BY is_default DESC, updated_at DESC`,
        [userId]
    );
    return result.rows;
};

export const getUserAddress = async (userId, addressId) => {
    const result = await pool.query(
        `${addressSelect} WHERE user_id = $1 AND address_id = $2 AND is_active = TRUE`,
        [userId, addressId]
    );
    return result.rows[0] ?? null;
};

export const getUserPrimaryAddress = async (userId) => {
    const result = await pool.query(
        `${addressSelect} WHERE user_id = $1 AND is_active = TRUE
         ORDER BY is_default DESC, updated_at DESC LIMIT 1`,
        [userId]
    );
    return result.rows[0] ?? null;
};

export const createUserAddress = async (details) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        // Check existing active addresses count
        const countRes = await client.query(
            "SELECT COUNT(*)::int AS count FROM user_addresses WHERE user_id = $1 AND is_active = TRUE",
            [details.userId]
        );
        const hasExisting = countRes.rows[0].count > 0;
        // If this is the user's first address, it is primary by default.
        const shouldBePrimary = !hasExisting || details.isPrimary === true || details.isDefault === true;

        if (shouldBePrimary && hasExisting) {
            await client.query(
                `UPDATE user_addresses SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1 AND is_default = TRUE`,
                [details.userId]
            );
        }

        const tag = details.tag || "HOME";
        const tagDetails = tag === "OTHER" ? (details.tagDetails || null) : null;

        const insertRes = await client.query(
            `INSERT INTO user_addresses
                (user_id, tag, tag_details, house_number, address_line_1, address_line_2,
                 landmark, city, state, pincode, latitude, longitude, is_default, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE)
             RETURNING address_id::INTEGER AS "addressId"`,
            [
                details.userId,
                tag,
                tagDetails,
                details.houseNumber || null,
                details.addressLine1,
                details.addressLine2 || null,
                details.landmark || null,
                details.city,
                details.state,
                details.pincode,
                details.latitude,
                details.longitude,
                shouldBePrimary,
            ]
        );

        await client.query("COMMIT");
        const addressId = insertRes.rows[0].addressId;
        return getUserAddress(details.userId, addressId);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

export const updateUserAddress = async (details) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const existing = await client.query(
            "SELECT is_default FROM user_addresses WHERE user_id = $1 AND address_id = $2 AND is_active = TRUE",
            [details.userId, details.addressId]
        );
        if (!existing.rowCount) {
            await client.query("ROLLBACK");
            return null;
        }

        const wantsPrimary = details.isPrimary === true || details.isDefault === true;
        if (wantsPrimary) {
            await client.query(
                `UPDATE user_addresses SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1 AND is_default = TRUE`,
                [details.userId]
            );
        }

        const tag = details.tag !== undefined ? details.tag : null;
        const tagDetails = tag === "OTHER" ? (details.tagDetails || null) : null;

        await client.query(
            `UPDATE user_addresses SET
                tag = COALESCE($2, tag),
                tag_details = CASE WHEN $2 = 'OTHER' THEN $3 WHEN $2 IS NOT NULL THEN NULL ELSE tag_details END,
                house_number = COALESCE($4, house_number),
                address_line_1 = COALESCE($5, address_line_1),
                address_line_2 = COALESCE($6, address_line_2),
                landmark = COALESCE($7, landmark),
                city = COALESCE($8, city),
                state = COALESCE($9, state),
                pincode = COALESCE($10, pincode),
                latitude = COALESCE($11, latitude),
                longitude = COALESCE($12, longitude),
                is_default = CASE WHEN $13 = TRUE THEN TRUE ELSE is_default END,
                updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND address_id = $14 AND is_active = TRUE`,
            [
                details.userId,
                tag,
                tagDetails,
                details.houseNumber !== undefined ? details.houseNumber : null,
                details.addressLine1 !== undefined ? details.addressLine1 : null,
                details.addressLine2 !== undefined ? details.addressLine2 : null,
                details.landmark !== undefined ? details.landmark : null,
                details.city !== undefined ? details.city : null,
                details.state !== undefined ? details.state : null,
                details.pincode !== undefined ? details.pincode : null,
                details.latitude !== undefined ? details.latitude : null,
                details.longitude !== undefined ? details.longitude : null,
                wantsPrimary,
                details.addressId,
            ]
        );

        await client.query("COMMIT");
        return getUserAddress(details.userId, details.addressId);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

export const setPrimaryUserAddress = async (userId, addressId) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const exists = await client.query(
            "SELECT address_id FROM user_addresses WHERE user_id = $1 AND address_id = $2 AND is_active = TRUE",
            [userId, addressId]
        );
        if (!exists.rowCount) {
            await client.query("ROLLBACK");
            return null;
        }

        await client.query(
            `UPDATE user_addresses SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND is_default = TRUE`,
            [userId]
        );
        await client.query(
            `UPDATE user_addresses SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND address_id = $2`,
            [userId, addressId]
        );

        await client.query("COMMIT");
        return getUserAddress(userId, addressId);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

export const deleteUserAddress = async (userId, addressId) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const current = await client.query(
            "SELECT is_default FROM user_addresses WHERE user_id = $1 AND address_id = $2 AND is_active = TRUE",
            [userId, addressId]
        );
        if (!current.rowCount) {
            await client.query("ROLLBACK");
            return false;
        }

        const wasPrimary = current.rows[0].is_default;
        await client.query(
            `UPDATE user_addresses SET is_active = FALSE, is_default = FALSE, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND address_id = $2`,
            [userId, addressId]
        );

        // If the deleted address was primary, promote the most recently updated active address
        if (wasPrimary) {
            const nextActive = await client.query(
                `SELECT address_id FROM user_addresses WHERE user_id = $1 AND is_active = TRUE
                 ORDER BY updated_at DESC LIMIT 1`,
                [userId]
            );
            if (nextActive.rowCount) {
                await client.query(
                    `UPDATE user_addresses SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = $1 AND address_id = $2`,
                    [userId, nextActive.rows[0].address_id]
                );
            }
        }

        await client.query("COMMIT");
        return true;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

