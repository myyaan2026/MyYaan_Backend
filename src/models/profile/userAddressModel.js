import pool from "../../config/db.js";

const addressSelect = `SELECT address_id::INTEGER AS "addressId",
    address_label AS "addressLabel", address_line_1 AS "addressLine1",
    address_line_2 AS "addressLine2", city, state, pincode, latitude, longitude,
    is_default AS "isDefault", created_at AS "createdAt", updated_at AS "updatedAt"
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

const saveAddress = async (details, isCreate) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        if (details.isDefault) {
            await client.query(
                `UPDATE user_addresses SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1 AND is_default = TRUE`,
                [details.userId]
            );
        }
        const values = [details.userId, details.addressLabel, details.addressLine1,
            details.addressLine2, details.city, details.state, details.pincode,
            details.latitude, details.longitude, details.isDefault];
        const result = isCreate
            ? await client.query(
                `INSERT INTO user_addresses
                    (user_id, address_label, address_line_1, address_line_2, city,
                     state, pincode, latitude, longitude, is_default)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                 RETURNING address_id::INTEGER AS "addressId"`, values)
            : await client.query(
                `UPDATE user_addresses SET address_label=$2, address_line_1=$3,
                    address_line_2=$4, city=$5, state=$6, pincode=$7, latitude=$8,
                    longitude=$9, is_default=$10, updated_at=CURRENT_TIMESTAMP
                 WHERE user_id=$1 AND address_id=$11 AND is_active=TRUE
                 RETURNING address_id::INTEGER AS "addressId"`, [...values, details.addressId]);
        if (!result.rowCount) {
            await client.query("ROLLBACK");
            return null;
        }
        await client.query("COMMIT");
        return result.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

export const createUserAddress = (details) => saveAddress(details, true);
export const updateUserAddress = (details) => saveAddress(details, false);

export const deleteUserAddress = async (userId, addressId) => {
    const result = await pool.query(
        `UPDATE user_addresses SET is_active=FALSE, is_default=FALSE,
                updated_at=CURRENT_TIMESTAMP
         WHERE user_id=$1 AND address_id=$2 AND is_active=TRUE RETURNING address_id`,
        [userId, addressId]
    );
    return Boolean(result.rowCount);
};

