import pool from "../../config/db.js";

const serviceSelect = `SELECT service_id::INTEGER AS "serviceId", service_code AS "serviceCode",
    service_name AS "serviceName", service_type AS "serviceType" FROM service_types`;
const centerSelect = `SELECT service_center_id::INTEGER AS "serviceCenterId",
    service_center_name AS "serviceCenterName", service_center_pic_url AS "serviceCenterPicUrl",
    address_line_1 AS "addressLine1", address_line_2 AS "addressLine2",
    city, state, pincode, latitude, longitude, is_active AS "isActive",
    created_at AS "createdAt", updated_at AS "updatedAt" FROM service_centers`;

export const getEnabledServices = async (serviceId = null) => {
    const result = await pool.query(
        `${serviceSelect} WHERE is_enabled=TRUE AND ($1::int IS NULL OR service_id=$1)
         ORDER BY service_type, service_name`,
        [serviceId]
    );
    return serviceId ? (result.rows[0] ?? null) : result.rows;
};

export const getServicePartnerOnboarding = async (userId) => {
    const result = await pool.query(
        `SELECT users.is_profile_updated AS "isProfileUpdated",
                COALESCE(onboarding.is_personal_details_completed,FALSE) AS "isPersonalDetailsCompleted",
                COALESCE(onboarding.is_service_center_details_completed,FALSE) AS "isServiceCenterDetailsCompleted",
                COALESCE(onboarding.is_services_completed,FALSE) AS "isServicesCompleted"
         FROM users JOIN roles ON roles.role_id=users.role_id AND roles.code='service_partner'
         LEFT JOIN service_partner_onboarding onboarding ON onboarding.user_id=users.user_id
         WHERE users.user_id=$1 AND users.is_verified=TRUE`,
        [userId]
    );
    return result.rows[0] ?? null;
};

export const getServiceCenters = async (userId) => {
    const result = await pool.query(
        `${centerSelect} WHERE user_id=$1 AND is_active=TRUE ORDER BY updated_at DESC`, [userId]
    );
    return result.rows;
};

export const getServiceCenter = async (userId, serviceCenterId) => {
    const result = await pool.query(
        `${centerSelect} WHERE user_id=$1 AND service_center_id=$2 AND is_active=TRUE`,
        [userId, serviceCenterId]
    );
    return result.rows[0] ?? null;
};

export const getMyServiceCenter = async (userId) => {
    const result = await pool.query(
        `${centerSelect} WHERE user_id=$1 AND is_active=TRUE
         ORDER BY created_at, service_center_id LIMIT 1`,
        [userId]
    );
    return result.rows[0] ?? null;
};

const syncOnboarding = async (client, userId) => {
    await client.query(
        `INSERT INTO service_partner_onboarding (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`, [userId]
    );
    await client.query(
        `UPDATE service_partner_onboarding SET
            is_personal_details_completed=EXISTS(
                SELECT 1 FROM user_profiles WHERE user_id=$1 AND is_completed=TRUE),
            is_service_center_details_completed=EXISTS(
                SELECT 1 FROM service_centers WHERE user_id=$1 AND is_active=TRUE),
            is_services_completed=EXISTS(
                SELECT 1 FROM service_center_services mapping
                JOIN service_centers center ON center.service_center_id=mapping.service_center_id
                WHERE center.user_id=$1 AND center.is_active=TRUE),
            updated_at=CURRENT_TIMESTAMP WHERE user_id=$1`, [userId]
    );
    await client.query(
        `UPDATE users SET is_profile_updated=onboarding.is_personal_details_completed
                AND onboarding.is_service_center_details_completed AND onboarding.is_services_completed,
                updated_at=CURRENT_TIMESTAMP
         FROM service_partner_onboarding onboarding
         WHERE users.user_id=onboarding.user_id AND users.user_id=$1`, [userId]
    );
};

const withPartner = async (userId, action) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const partner = await client.query(
            `SELECT 1 FROM users JOIN roles ON roles.role_id=users.role_id
             WHERE users.user_id=$1 AND roles.code='service_partner'
               AND users.is_verified=TRUE AND users.is_login_enabled=TRUE FOR UPDATE`, [userId]
        );
        if (!partner.rowCount) { await client.query("ROLLBACK"); return { status: "partner_not_found" }; }
        const result = await action(client);
        if (result?.status && !["saved","created"].includes(result.status)) {
            await client.query("ROLLBACK"); return result;
        }
        await syncOnboarding(client, userId);
        await client.query("COMMIT");
        return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
};

const centerValues = (details) => [details.userId, details.serviceCenterName,
    details.serviceCenterPicUrl, details.addressLine1, details.addressLine2,
    details.city, details.state, details.pincode, details.latitude, details.longitude];

export const createServiceCenter = (details) => withPartner(details.userId, async (client) => {
    const result = await client.query(
        `INSERT INTO service_centers (user_id,service_center_name,service_center_pic_url,
            address_line_1,address_line_2,city,state,pincode,latitude,longitude)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING service_center_id::INTEGER AS "serviceCenterId"`, centerValues(details)
    );
    return { status: "created", ...result.rows[0] };
});

export const updateServiceCenter = (details) => withPartner(details.userId, async (client) => {
    const result = await client.query(
        `UPDATE service_centers SET service_center_name=$2,service_center_pic_url=$3,
            address_line_1=$4,address_line_2=$5,city=$6,state=$7,pincode=$8,
            latitude=$9,longitude=$10,updated_at=CURRENT_TIMESTAMP
         WHERE user_id=$1 AND service_center_id=$11 AND is_active=TRUE RETURNING service_center_id`,
        [...centerValues(details), details.serviceCenterId]
    );
    return result.rowCount ? { status: "saved" } : { status: "center_not_found" };
});

export const saveMyServiceCenter = (details) => withPartner(details.userId, async (client) => {
    const existing = await client.query(
        `SELECT service_center_id FROM service_centers
         WHERE user_id=$1 AND is_active=TRUE
         ORDER BY created_at, service_center_id LIMIT 1 FOR UPDATE`,
        [details.userId]
    );
    if (!existing.rowCount) {
        const created = await client.query(
            `INSERT INTO service_centers (user_id,service_center_name,service_center_pic_url,
                address_line_1,address_line_2,city,state,pincode,latitude,longitude)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING service_center_id::INTEGER AS "serviceCenterId"`,
            centerValues(details)
        );
        return { status: "created", ...created.rows[0] };
    }
    const serviceCenterId = Number(existing.rows[0].service_center_id);
    await client.query(
        `UPDATE service_centers SET service_center_name=$2,service_center_pic_url=$3,
            address_line_1=$4,address_line_2=$5,city=$6,state=$7,pincode=$8,
            latitude=$9,longitude=$10,updated_at=CURRENT_TIMESTAMP
         WHERE user_id=$1 AND service_center_id=$11`,
        [...centerValues(details), serviceCenterId]
    );
    return { status: "saved", serviceCenterId };
});

export const getSelectedServices = async (userId, serviceCenterId) => {
    const result = await pool.query(
        `${serviceSelect} JOIN service_center_services mapping ON mapping.service_type_id=service_types.service_id
         JOIN service_centers center ON center.service_center_id=mapping.service_center_id
         WHERE center.user_id=$1 AND center.service_center_id=$2 AND center.is_active=TRUE
         ORDER BY service_name`, [userId, serviceCenterId]
    );
    return result.rows;
};

export const getServicesForPartner = async (userId) => {
    const result = await pool.query(
        `WITH partner_center AS (
            SELECT service_center_id
            FROM service_centers
            WHERE user_id=$1 AND is_active=TRUE
            ORDER BY created_at, service_center_id
            LIMIT 1
         )
         SELECT service_types.service_id::INTEGER AS "serviceId",
                service_types.service_code AS "serviceCode",
                service_types.service_name AS "serviceName",
                service_types.service_type AS "serviceType",
                EXISTS (
                    SELECT 1
                    FROM service_center_services mapping
                    JOIN partner_center center
                      ON center.service_center_id=mapping.service_center_id
                    WHERE mapping.service_type_id=service_types.service_id
                ) AS "isSelected"
         FROM service_types
         WHERE service_types.is_enabled=TRUE
         ORDER BY service_types.service_type, service_types.service_name`,
        [userId]
    );
    return result.rows;
};

export const saveServiceOffers = ({ userId, serviceCenterId, serviceIds }) =>
    withPartner(userId, async (client) => {
        const center = await client.query(
            `SELECT 1 FROM service_centers WHERE user_id=$1 AND service_center_id=$2
             AND is_active=TRUE FOR UPDATE`, [userId, serviceCenterId]
        );
        if (!center.rowCount) return { status: "center_not_found" };
        const services = await client.query(
            `SELECT service_id FROM service_types WHERE service_id=ANY($1::int[]) AND is_enabled=TRUE`, [serviceIds]
        );
        if (services.rowCount !== serviceIds.length) return { status: "invalid_services" };
        await client.query("DELETE FROM service_center_services WHERE service_center_id=$1", [serviceCenterId]);
        await client.query(
            `INSERT INTO service_center_services(service_center_id,service_type_id)
             SELECT $1,unnest($2::int[])`, [serviceCenterId, serviceIds]
        );
        return { status: "saved" };
    });

export const saveMyServiceOffers = async ({ userId, serviceIds }) => {
    const center = await getMyServiceCenter(userId);
    if (!center) return { status: "center_not_found" };
    return saveServiceOffers({ userId, serviceCenterId: center.serviceCenterId, serviceIds });
};
