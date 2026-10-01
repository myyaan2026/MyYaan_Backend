import pool from "../../../../config/db.js";
import { getUserVehicleById } from "../../../vehicle/userVehicleModel.js";

const categoryForVehicle = (vehicleType) => vehicleType.includes("BIKE") ? "BIKE" : "CAR";

export const normalizeSubServiceType = (code, name = "") => {
    const text = `${code ?? ""} ${name ?? ""}`.toUpperCase();
    if (text.includes("PICK")) return "PICK_N_DROP";
    if (text.includes("HOME") || text.includes("DOORSTEP")) return "HOME_SERVICE";
    return "WALK_IN";
};

export const calculateServicePrice = ({
    subServiceCode,
    subServiceName,
    customPricing,
    catalogBasePrice = 0,
    platformCommission = 50,
}) => {
    const type = normalizeSubServiceType(subServiceCode, subServiceName);

    const walkInPrice = customPricing?.walkInPrice !== undefined && customPricing?.walkInPrice !== null
        ? Number(customPricing.walkInPrice)
        : (Number(catalogBasePrice) > 0 ? Number(catalogBasePrice) : 200);

    const pickDropCharge = customPricing?.pickDropCharge !== undefined && customPricing?.pickDropCharge !== null
        ? Number(customPricing.pickDropCharge)
        : 200;

    const homeServicePrice = customPricing?.homeServicePrice !== undefined && customPricing?.homeServicePrice !== null
        ? Number(customPricing.homeServicePrice)
        : Math.max(walkInPrice, 500);

    const commissionAmount = customPricing?.commissionAmount !== undefined && customPricing?.commissionAmount !== null
        ? Number(customPricing.commissionAmount)
        : Number(platformCommission || 0);

    let basePrice = walkInPrice;
    let deliveryCharge = 0;

    if (type === "PICK_N_DROP") {
        basePrice = walkInPrice;
        deliveryCharge = pickDropCharge;
    } else if (type === "HOME_SERVICE") {
        basePrice = homeServicePrice;
        deliveryCharge = 0;
    } else {
        basePrice = walkInPrice;
        deliveryCharge = 0;
    }

    const priceBeforeCommission = basePrice + deliveryCharge;
    const finalPrice = Math.round((priceBeforeCommission + commissionAmount) * 100) / 100;

    return {
        deliveryType: type,
        basePrice,
        deliveryCharge,
        commissionAmount,
        priceBeforeCommission,
        finalPrice,
    };
};

export const findAvailableServicePartners = async ({ userId, vehicleId, serviceId, subServiceId, serviceOptionId = null, latitude, longitude, distanceKm }) => {
    const vehicle = await getUserVehicleById(userId, vehicleId);
    if (!vehicle) return { status: "vehicle_not_found" };
    const category = categoryForVehicle(vehicle.vehicleType);
    const service = await pool.query(
        `SELECT 1 FROM service_types WHERE service_id=$1 AND is_enabled=TRUE
         AND vehicle_category IN ($2, 'ANY')`, [serviceId, category]
    );
    if (!service.rowCount) return { status: "service_not_available" };

    const subServiceRes = await pool.query(
        "SELECT sub_service_id, sub_service_code, sub_service_name FROM service_sub_types WHERE sub_service_id=$1 AND service_id=$2 AND is_enabled=TRUE",
        [subServiceId, serviceId]
    );
    if (!subServiceRes.rowCount) return { status: "sub_service_not_available" };
    const subServiceInfo = subServiceRes.rows[0];

    let optionQuery;
    let optionParams;
    if (serviceOptionId) {
        optionQuery = `SELECT service_option_id::INTEGER AS "serviceOptionId", service_option_name AS "serviceOptionName",
            base_price::NUMERIC(10,2) AS "basePrice"
            FROM service_options
            WHERE service_option_id=$1 AND service_id=$2 AND is_enabled=TRUE AND vehicle_category IN ($3, 'ANY')`;
        optionParams = [serviceOptionId, serviceId, category];
    } else {
        optionQuery = `SELECT service_option_id::INTEGER AS "serviceOptionId", service_option_name AS "serviceOptionName",
            base_price::NUMERIC(10,2) AS "basePrice"
            FROM service_options
            WHERE service_id=$1 AND is_enabled=TRUE AND vehicle_category IN ($2, 'ANY')
            ORDER BY is_default DESC, display_order, service_option_id LIMIT 1`;
        optionParams = [serviceId, category];
    }
    const optionResult = await pool.query(optionQuery, optionParams);
    const selectedOption = optionResult.rows[0] ?? null;

    const hasPricingTable = await pool.query(
        "SELECT to_regclass('service_center_pricing') AS tbl"
    ).then((r) => !!r.rows[0]?.tbl).catch(() => false);

    const pricingJoin = hasPricingTable
        ? `LEFT JOIN service_center_pricing pricing
             ON pricing.service_center_id = center.service_center_id AND pricing.service_id = $3`
        : "";

    const pricingCols = hasPricingTable
        ? `pricing.walk_in_price AS "walkInPrice",
           pricing.pick_drop_charge AS "pickDropCharge",
           pricing.home_service_price AS "homeServicePrice",
           pricing.commission_amount AS "commissionAmount",`
        : `NULL AS "walkInPrice", NULL AS "pickDropCharge", NULL AS "homeServicePrice", NULL AS "commissionAmount",`;

    const supportTable = category === "BIKE" ? "service_center_bike_models" : "service_center_car_models";
    const modelColumn = category === "BIKE" ? "bike_model_id" : "car_model_id";

    const result = await pool.query(
        `WITH eligible_centers AS (
            SELECT center.service_center_id, center.service_center_name, center.service_center_pic_url,
                   center.address_line_1, center.address_line_2, center.city, center.state, center.pincode,
                   center.latitude, center.longitude,
                   ${pricingCols}
                   6371 * acos(LEAST(1.0, GREATEST(-1.0,
                       cos(radians($1)) * cos(radians(center.latitude)) *
                       cos(radians(center.longitude) - radians($2)) +
                       sin(radians($1)) * sin(radians(center.latitude))
                   ))) AS distance_km
            FROM service_centers center
            JOIN service_center_services offered
              ON offered.service_center_id=center.service_center_id AND offered.service_type_id=$3
            JOIN service_center_sub_services delivery
              ON delivery.service_center_id=center.service_center_id
             AND delivery.service_id=$3 AND delivery.sub_service_id=$4
            ${pricingJoin}
            WHERE center.is_active=TRUE AND center.latitude IS NOT NULL AND center.longitude IS NOT NULL
              AND (
                  NOT EXISTS (SELECT 1 FROM ${supportTable} configured
                              WHERE configured.service_center_id=center.service_center_id AND configured.service_id=$3)
                  OR EXISTS (SELECT 1 FROM ${supportTable} supported
                             WHERE supported.service_center_id=center.service_center_id
                               AND supported.service_id=$3 AND supported.${modelColumn}=$5)
              )
        )
         SELECT service_center_id::INTEGER AS "serviceCenterId", service_center_name AS "serviceCenterName",
                service_center_pic_url AS "serviceCenterPicUrl", address_line_1, address_line_2,
                city, state, pincode, latitude, longitude,
                "walkInPrice", "pickDropCharge", "homeServicePrice", "commissionAmount",
                ROUND(distance_km::numeric, 2) AS "distanceKm"
         FROM eligible_centers WHERE distance_km <= $6
         ORDER BY distance_km, service_center_name`,
        [latitude, longitude, serviceId, subServiceId, vehicle.modelId, distanceKm]
    );

    const defaultCommission = Number(process.env.COMMISSION_AMOUNT ?? 50);

    const partners = result.rows.map((row) => {
        const address = [row.address_line_1, row.address_line_2, row.city, row.state, row.pincode]
            .filter(Boolean).join(", ");

        const priceCalc = calculateServicePrice({
            subServiceCode: subServiceInfo.sub_service_code,
            subServiceName: subServiceInfo.sub_service_name,
            customPricing: {
                walkInPrice: row.walkInPrice,
                pickDropCharge: row.pickDropCharge,
                homeServicePrice: row.homeServicePrice,
                commissionAmount: row.commissionAmount,
            },
            catalogBasePrice: selectedOption ? Number(selectedOption.basePrice) : 200,
            platformCommission: defaultCommission,
        });

        return {
            servicePartnerId: row.serviceCenterId,
            serviceCenterId: row.serviceCenterId,
            name: row.serviceCenterName,
            address,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            distanceKm: Number(row.distanceKm),
            price: priceCalc.finalPrice,
            priceBreakup: {
                basePrice: priceCalc.basePrice,
                deliveryCharge: priceCalc.deliveryCharge,
                deliveryType: priceCalc.deliveryType,
                commission: priceCalc.commissionAmount,
                finalPrice: priceCalc.finalPrice,
            },
            serviceCenterImage: row.serviceCenterPicUrl,
            serviceOptionId: selectedOption?.serviceOptionId ?? null,
            serviceOptionName: selectedOption?.serviceOptionName ?? null,
        };
    });

    return {
        status: "ok",
        selectedOption,
        subService: {
            subServiceId: subServiceInfo.sub_service_id,
            subServiceCode: subServiceInfo.sub_service_code,
            subServiceName: subServiceInfo.sub_service_name,
        },
        partners,
    };
};
