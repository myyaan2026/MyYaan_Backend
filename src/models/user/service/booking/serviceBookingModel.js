import pool from "../../../../config/db.js";
import { getUserVehicleById, getUserVehicles } from "../../../vehicle/userVehicleModel.js";
import { calculateServicePrice, normalizeSubServiceType } from "../discovery/servicePartnerDiscoveryModel.js";

const categoryForVehicle = (vehicleType) => vehicleType.includes("BIKE") ? "BIKE" : "CAR";

export const BASE_SLOTS = [
    { slotId: "09:00-11:00", startTime: "09:00:00", endTime: "11:00:00", display: "09:00 AM - 11:00 AM" },
    { slotId: "11:00-13:00", startTime: "11:00:00", endTime: "13:00:00", display: "11:00 AM - 01:00 PM" },
    { slotId: "13:00-15:00", startTime: "13:00:00", endTime: "15:00:00", display: "01:00 PM - 03:00 PM" },
    { slotId: "15:00-17:00", startTime: "15:00:00", endTime: "17:00:00", display: "03:00 PM - 05:00 PM" },
    { slotId: "17:00-19:00", startTime: "17:00:00", endTime: "19:00:00", display: "05:00 PM - 07:00 PM" },
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const findMatchingSlot = (slotValue) => {
    const raw = String(slotValue ?? "").trim().toUpperCase().replace(/\s+/g, " ");
    return BASE_SLOTS.find((s) =>
        s.slotId.toUpperCase() === raw ||
        s.display.toUpperCase() === raw ||
        s.display.toUpperCase().replace(/\s/g, "") === raw.replace(/\s/g, "") ||
        s.slotId.replace(/\s/g, "") === raw.replace(/\s/g, "")
    ) ?? null;
};

export const getBookingStartData = async (userId, serviceId, vehicleId = null) => {
    const vehicles = await getUserVehicles(userId);
    const primaryVehicle = vehicles.find((vehicle) => vehicle.isPrimary) ?? null;
    if (!primaryVehicle && !vehicleId) return { status: "vehicle_required" };
    const selectedVehicle = vehicleId ? await getUserVehicleById(userId, vehicleId) : primaryVehicle;
    if (!selectedVehicle) return { status: "vehicle_not_found" };
    const service = await pool.query(
        `SELECT service_id::INTEGER AS "serviceId", service_code AS "serviceCode",
                service_name AS "serviceName", service_description AS "serviceDescription",
                service_type AS "serviceType", vehicle_category AS "vehicleCategory"
         FROM service_types WHERE service_id=$1 AND is_enabled=TRUE
           AND vehicle_category IN ($2, 'ANY')`,
        [serviceId, categoryForVehicle(selectedVehicle.vehicleType)]
    );
    if (!service.rowCount) return { status: "service_not_available" };
    const subServices = await pool.query(
        `SELECT sub_service_id::INTEGER AS "subServiceId", sub_service_code AS "subServiceCode",
            sub_service_name AS "subServiceName", sub_service_description AS "subServiceDescription",
            is_enabled AS "isEnabled" FROM service_sub_types
            WHERE service_id=$1 AND is_enabled=TRUE
            ORDER BY CASE sub_service_code
                WHEN 'HOME_SERVICE' THEN 1
                WHEN 'PICK_N_DROP' THEN 2
                WHEN 'WALK_IN' THEN 3
                ELSE 4
            END, sub_service_id DESC`,
        [serviceId]
    );
    return {
        status: "ok",
        primaryVehicle: primaryVehicle ?? selectedVehicle,
        ...(selectedVehicle && primaryVehicle && selectedVehicle.vehicleId !== primaryVehicle.vehicleId
            ? { selectedVehicle }
            : {}),
        service: service.rows[0],
        subServices: subServices.rows,
    };
};

export const getServiceOptionsData = async ({ userId, serviceId, subServiceId = null, vehicleId = null }) => {
    const vehicles = await getUserVehicles(userId);
    const primaryVehicle = vehicles.find((vehicle) => vehicle.isPrimary) ?? null;
    if (!primaryVehicle && !vehicleId) return { status: "vehicle_required" };

    const selectedVehicle = vehicleId ? await getUserVehicleById(userId, vehicleId) : primaryVehicle;
    if (!selectedVehicle) return { status: "vehicle_not_found" };

    const category = categoryForVehicle(selectedVehicle.vehicleType);

    const service = await pool.query(
        `SELECT service_id::INTEGER AS "serviceId", service_code AS "serviceCode",
                service_name AS "serviceName", service_description AS "serviceDescription",
                service_type AS "serviceType", vehicle_category AS "vehicleCategory"
         FROM service_types WHERE service_id=$1 AND is_enabled=TRUE
           AND vehicle_category IN ($2, 'ANY')`,
        [serviceId, category]
    );
    if (!service.rowCount) return { status: "service_not_available" };

    let subServiceInfo = null;
    if (subServiceId) {
        const subServiceRes = await pool.query(
            `SELECT sub_service_id::INTEGER AS "subServiceId", sub_service_code AS "subServiceCode",
                    sub_service_name AS "subServiceName", sub_service_description AS "subServiceDescription",
                    is_enabled AS "isEnabled"
             FROM service_sub_types
             WHERE sub_service_id=$1 AND service_id=$2 AND is_enabled=TRUE`,
            [subServiceId, serviceId]
        );
        if (!subServiceRes.rowCount) return { status: "sub_service_not_available" };
        subServiceInfo = subServiceRes.rows[0];
    }

    const serviceOptions = await pool.query(
        `SELECT service_option_id::INTEGER AS "serviceOptionId", service_option_code AS "serviceOptionCode",
            service_option_name AS "serviceOptionName", service_option_description AS "serviceOptionDescription",
            short_description AS "shortDescription", full_description AS "fullDescription", tags AS "tags",
            checklist AS "checklist", base_price::FLOAT AS "basePrice", additional_charge_note AS "additionalChargeNote",
            estimated_duration_minutes AS "estimatedDurationMinutes", warranty_description AS "warrantyDescription",
            vehicle_category AS "vehicleCategory", is_enabled AS "isEnabled", is_default AS "isDefaultSelected",
            display_order AS "displayOrder" FROM service_options
            WHERE service_id=$1 AND is_enabled=TRUE AND vehicle_category IN ($2, 'ANY')
            ORDER BY is_default DESC, display_order, service_option_name`,
        [serviceId, category]
    );

    return {
        status: "ok",
        vehicle: selectedVehicle,
        service: service.rows[0],
        ...(subServiceInfo ? { subService: subServiceInfo } : {}),
        serviceOptions: serviceOptions.rows,
    };
};

export const computeSlotsForDate = (dateStr, bookingsMap = new Map()) => {
    const todayStr = new Date().toISOString().split("T")[0];
    if (dateStr < todayStr) return [];

    const isToday = dateStr === todayStr;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const availableSlots = [];
    const MAX_CAPACITY_PER_SLOT = 2;

    for (const slot of BASE_SLOTS) {
        const [slotH, slotM] = slot.startTime.split(":").map(Number);
        const slotMinutes = slotH * 60 + slotM;

        if (isToday && slotMinutes <= currentMinutes + 30) {
            continue;
        }

        const bookedCount = bookingsMap.get(`${dateStr}_${slot.display}`) ??
                            bookingsMap.get(`${dateStr}_${slot.slotId}`) ??
                            bookingsMap.get(slot.display) ??
                            bookingsMap.get(slot.slotId) ?? 0;

        if (bookedCount >= MAX_CAPACITY_PER_SLOT) {
            continue;
        }

        availableSlots.push({
            slotId: slot.slotId,
            display: slot.display,
            startTime: slot.startTime,
            endTime: slot.endTime,
            durationHours: 2,
        });
    }

    return availableSlots;
};

export const getAvailableTimeSlots = async ({ serviceCenterId, date = null }) => {
    const center = await pool.query(
        "SELECT service_center_id, service_center_name FROM service_centers WHERE service_center_id=$1 AND is_active=TRUE",
        [serviceCenterId]
    );
    if (!center.rowCount) return { status: "center_not_found" };

    const targetDates = [];
    if (date) {
        targetDates.push(date);
    } else {
        const now = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() + i);
            targetDates.push(d.toISOString().split("T")[0]);
        }
    }

    const bookingsMap = new Map();
    try {
        const bookingsResult = await pool.query(
            `SELECT booking_date::text AS booking_date, booking_time_slot, slot_start_time, COUNT(*)::int AS count
             FROM service_bookings
             WHERE service_center_id=$1 AND booking_date = ANY($2::date[]) AND booking_status NOT IN ('CANCELLED')
             GROUP BY booking_date, booking_time_slot, slot_start_time`,
            [serviceCenterId, targetDates]
        );
        for (const row of bookingsResult.rows) {
            const dateOnly = String(row.booking_date).split("T")[0];
            bookingsMap.set(`${dateOnly}_${row.booking_time_slot}`, Number(row.count));
            bookingsMap.set(row.booking_time_slot, Number(row.count));
        }
    } catch (e) {
        // Table may be empty
    }

    const days = targetDates.map((dStr) => {
        const dObj = new Date(`${dStr}T00:00:00`);
        const dayName = DAY_NAMES[dObj.getDay()] ?? "";
        const slots = computeSlotsForDate(dStr, bookingsMap);
        return {
            date: dStr,
            dayName,
            availableSlots: slots,
        };
    });

    if (date) {
        return {
            status: "ok",
            serviceCenterId,
            date,
            dayName: days[0]?.dayName ?? "",
            availableSlots: days[0]?.availableSlots ?? [],
            days,
        };
    }

    return {
        status: "ok",
        serviceCenterId,
        startDate: targetDates[0],
        endDate: targetDates[targetDates.length - 1],
        days,
        availableSlots: days[0]?.availableSlots ?? [],
    };
};

export const getAvailableCoupons = async () => {
    const result = await pool.query(
        `SELECT id AS "couponId",
                code AS "couponCode",
                title,
                description,
                discount_type AS "discountType",
                discount_value::NUMERIC(10,2) AS "discountValue",
                min_order_value::NUMERIC(10,2) AS "minOrderAmount",
                max_discount_amount::NUMERIC(10,2) AS "maxDiscountAmount",
                start_date AS "startDate",
                end_date AS "validUntil",
                applicable_vehicle_type AS "applicableVehicleType",
                is_active AS "isActive"
         FROM coupons
         WHERE is_active = TRUE
           AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
           AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)
         ORDER BY min_order_value ASC, discount_value DESC`
    );
    return result.rows;
};

export const calculateDiscount = ({ discountType, discountValue, minOrderAmount, maxDiscountAmount, orderAmount }) => {
    const numOrderAmount = Number(orderAmount);
    if (!Number.isFinite(numOrderAmount) || numOrderAmount <= 0) {
        return { isValid: false, message: "Invalid order amount", discountAmount: 0, finalAmount: 0 };
    }
    const minOrder = Number(minOrderAmount || 0);
    if (numOrderAmount < minOrder) {
        return {
            isValid: false,
            message: `Minimum order amount of ₹${minOrder.toFixed(0)} required to use this coupon`,
            discountAmount: 0,
            finalAmount: numOrderAmount,
        };
    }
    let discount = 0;
    const type = String(discountType || "").toUpperCase();
    if (type === "PERCENTAGE") {
        discount = (numOrderAmount * Number(discountValue || 0)) / 100;
        if (maxDiscountAmount && discount > Number(maxDiscountAmount)) {
            discount = Number(maxDiscountAmount);
        }
    } else {
        discount = Math.min(Number(discountValue || 0), numOrderAmount);
    }
    discount = Math.round(discount * 100) / 100;
    const finalAmount = Math.max(0, Math.round((numOrderAmount - discount) * 100) / 100);
    return {
        isValid: true,
        discountAmount: discount,
        finalAmount,
        message: "Coupon applied successfully",
    };
};

export const applyCouponDiscount = async ({ couponCode, orderAmount }) => {
    const cleanCode = String(couponCode ?? "").trim().toUpperCase();
    if (!cleanCode) return { isValid: false, message: "Provide a coupon code" };
    const numOrderAmount = Number(orderAmount);
    if (!Number.isFinite(numOrderAmount) || numOrderAmount <= 0) {
        return { isValid: false, message: "Invalid order amount" };
    }

    const couponResult = await pool.query(
        `SELECT id AS "couponId",
                code AS "couponCode",
                title,
                description,
                discount_type AS "discountType",
                discount_value::NUMERIC(10,2) AS "discountValue",
                min_order_value::NUMERIC(10,2) AS "minOrderAmount",
                max_discount_amount::NUMERIC(10,2) AS "maxDiscountAmount",
                start_date AS "startDate",
                end_date AS "validUntil",
                applicable_vehicle_type AS "applicableVehicleType",
                is_active AS "isActive"
         FROM coupons
         WHERE UPPER(code)=$1`,
        [cleanCode]
    );

    if (!couponResult.rowCount) {
        return { isValid: false, message: "Invalid coupon code" };
    }

    const coupon = couponResult.rows[0];
    if (!coupon.isActive) {
        return { isValid: false, message: "This coupon is no longer active" };
    }
    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
        return { isValid: false, message: "This coupon is not active yet" };
    }
    if (coupon.validUntil && new Date(coupon.validUntil) < now) {
        return { isValid: false, message: "This coupon has expired" };
    }

    const discountCalc = calculateDiscount({
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
        orderAmount: numOrderAmount,
    });

    if (!discountCalc.isValid) {
        return discountCalc;
    }

    return {
        isValid: true,
        couponId: coupon.couponId,
        couponCode: coupon.couponCode,
        title: coupon.title,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
        discountAmount: discountCalc.discountAmount,
        finalAmount: discountCalc.finalAmount,
        message: "Coupon applied successfully",
    };
};

export const reviewBookingData = async ({
    userId,
    serviceCenterId,
    vehicleId,
    serviceId,
    subServiceId,
    serviceOptionId,
    bookingDate,
    bookingTimeSlot,
    couponCode = null,
}) => {
    const vehicle = await getUserVehicleById(userId, vehicleId);
    if (!vehicle) return { status: "vehicle_not_found" };

    const centerRes = await pool.query(
        `SELECT service_center_id AS "serviceCenterId", service_center_name AS "name",
                service_center_pic_url AS "serviceCenterImage", address_line_1, address_line_2,
                city, state, pincode, latitude, longitude
         FROM service_centers WHERE service_center_id=$1 AND is_active=TRUE`,
        [serviceCenterId]
    );
    if (!centerRes.rowCount) return { status: "center_not_found" };
    const center = centerRes.rows[0];
    const centerAddress = [center.address_line_1, center.address_line_2, center.city, center.state, center.pincode]
        .filter(Boolean).join(", ");

    const serviceRes = await pool.query(
        "SELECT service_id, service_name, service_type FROM service_types WHERE service_id=$1 AND is_enabled=TRUE",
        [serviceId]
    );
    if (!serviceRes.rowCount) return { status: "service_not_available" };

    const subRes = await pool.query(
        "SELECT sub_service_id, sub_service_code, sub_service_name FROM service_sub_types WHERE sub_service_id=$1 AND service_id=$2 AND is_enabled=TRUE",
        [subServiceId, serviceId]
    );
    if (!subRes.rowCount) return { status: "sub_service_not_available" };
    const subServiceInfo = subRes.rows[0];

    const category = categoryForVehicle(vehicle.vehicleType);
    const optionRes = await pool.query(
        `SELECT service_option_id, service_option_name, base_price, estimated_duration_minutes, warranty_description
         FROM service_options WHERE service_option_id=$1 AND service_id=$2 AND is_enabled=TRUE AND vehicle_category IN ($3, 'ANY')`,
        [serviceOptionId, serviceId, category]
    );
    if (!optionRes.rowCount) return { status: "service_option_not_available" };
    const option = optionRes.rows[0];

    const matchedSlot = findMatchingSlot(bookingTimeSlot);
    if (!matchedSlot) return { status: "invalid_time_slot" };

    // Query custom pricing from service_partner_price_configs
    let customWalkIn = null;
    let customPickDrop = null;
    let customHome = null;
    try {
        const query = `
            SELECT 
                cfg.default_price::NUMERIC(10,2) AS "walkInPrice",
                cfg.pick_n_drop_charge::NUMERIC(10,2) AS "pickDropCharge",
                cfg.home_service_charge::NUMERIC(10,2) AS "homeServicePrice",
                m.override_price::NUMERIC(10,2) AS "overridePrice"
            FROM service_partner_price_configs cfg
            LEFT JOIN service_partner_price_models m
              ON m.price_config_id = cfg.price_config_id
             AND m.vehicle_model_id = $4
            WHERE cfg.service_center_id = $1
              AND cfg.service_id = $2
              AND ($3::int IS NULL OR cfg.service_option_id = $3 OR cfg.service_option_id IS NULL)
              AND (cfg.vehicle_category = $5 OR cfg.vehicle_category = 'ALL')
            ORDER BY 
              CASE WHEN m.override_price IS NOT NULL THEN 0 ELSE 1 END,
              CASE WHEN cfg.service_option_id = $3 THEN 0 ELSE 1 END,
              cfg.price_config_id DESC
            LIMIT 1;
        `;
        const res = await pool.query(query, [
            serviceCenterId,
            serviceId,
            serviceOptionId,
            vehicle.modelId,
            category,
        ]);
        if (res.rowCount) {
            const row = res.rows[0];
            customWalkIn = row.overridePrice !== null ? Number(row.overridePrice) : (row.walkInPrice !== null ? Number(row.walkInPrice) : null);
            if (row.pickDropCharge !== null) customPickDrop = Number(row.pickDropCharge);
            if (row.homeServicePrice !== null) customHome = Number(row.homeServicePrice);
        }
    } catch (e) {
        // Fallback
    }

    const normType = normalizeSubServiceType(subServiceInfo.sub_service_code, subServiceInfo.sub_service_name);
    const walkInPrice = customWalkIn ?? Number(option.base_price || 200);
    const pickDropCharge = customPickDrop ?? 200;
    const homeServicePrice = customHome ?? 500;

    const priceBeforeComm = normType === "PICK_N_DROP"
        ? walkInPrice + pickDropCharge
        : normType === "HOME_SERVICE"
            ? homeServicePrice
            : walkInPrice;

    // Commission lookup from commission_rules
    let commissionAmount = Number(process.env.COMMISSION_AMOUNT ?? 50);
    try {
        const commRes = await pool.query(`
            SELECT commission_type, commission_value,
                   pick_n_drop_commission_type, pick_n_drop_commission_value,
                   home_service_commission_type, home_service_commission_value
            FROM commission_rules
            WHERE is_active = TRUE
              AND ($1::bigint IS NULL OR service_center_id = $1 OR service_center_id IS NULL)
            ORDER BY priority DESC, id DESC
            LIMIT 1;
        `, [serviceCenterId]);

        if (commRes.rowCount) {
            const rule = commRes.rows[0];
            let cType = rule.commission_type;
            let cVal = Number(rule.commission_value || 0);

            if (normType === "PICK_N_DROP" && rule.pick_n_drop_commission_value !== null) {
                cType = rule.pick_n_drop_commission_type || cType;
                cVal = Number(rule.pick_n_drop_commission_value);
            } else if (normType === "HOME_SERVICE" && rule.home_service_commission_value !== null) {
                cType = rule.home_service_commission_type || cType;
                cVal = Number(rule.home_service_commission_value);
            }

            if (String(cType).toUpperCase() === "PERCENTAGE") {
                commissionAmount = Math.round(((priceBeforeComm * cVal) / 100) * 100) / 100;
            } else {
                commissionAmount = cVal;
            }
        }
    } catch (e) {
        // Fallback
    }

    const priceCalc = calculateServicePrice({
        subServiceCode: subServiceInfo.sub_service_code,
        subServiceName: subServiceInfo.sub_service_name,
        customPricing: {
            walkInPrice: customWalkIn,
            pickDropCharge: customPickDrop,
            homeServicePrice: customHome,
            commissionAmount,
        },
        catalogBasePrice: option.base_price,
        platformCommission: commissionAmount,
    });

    const subtotal = priceCalc.finalPrice;
    let discountAmount = 0;
    let appliedCoupon = null;

    const cleanCoupon = String(couponCode ?? "").trim();
    if (cleanCoupon) {
        const couponCheck = await applyCouponDiscount({ couponCode: cleanCoupon, orderAmount: subtotal });
        if (couponCheck.isValid) {
            discountAmount = couponCheck.discountAmount;
            appliedCoupon = {
                couponCode: couponCheck.couponCode,
                title: couponCheck.title,
                discountAmount: couponCheck.discountAmount,
            };
        } else {
            return {
                status: "invalid_coupon",
                message: couponCheck.message || "Invalid or ineligible coupon code",
            };
        }
    }

    const finalAmount = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    return {
        status: "ok",
        serviceCenter: {
            serviceCenterId: center.serviceCenterId,
            name: center.name,
            address: centerAddress,
            latitude: Number(center.latitude),
            longitude: Number(center.longitude),
            serviceCenterImage: center.serviceCenterImage,
        },
        vehicle: {
            vehicleId: vehicle.vehicleId,
            vehicleType: vehicle.vehicleType,
            vehicleNumber: vehicle.vehicleNumber,
            companyName: vehicle.companyName,
            modelName: vehicle.modelName,
        },
        service: {
            serviceId: Number(serviceRes.rows[0].service_id),
            serviceName: serviceRes.rows[0].service_name,
            subServiceId: Number(subRes.rows[0].sub_service_id),
            subServiceName: subRes.rows[0].sub_service_name,
            serviceOptionId: Number(option.service_option_id),
            serviceOptionName: option.service_option_name,
            estimatedDurationMinutes: option.estimated_duration_minutes,
            warrantyDescription: option.warranty_description,
        },
        slot: {
            date: bookingDate,
            timeSlot: matchedSlot.display,
            startTime: matchedSlot.startTime,
            endTime: matchedSlot.endTime,
        },
        pricing: {
            basePrice: priceCalc.basePrice,
            deliveryCharge: priceCalc.deliveryCharge,
            deliveryType: priceCalc.deliveryType,
            commissionAmount: priceCalc.commissionAmount,
            subtotal,
            discountAmount,
            coupon: appliedCoupon,
            finalAmount,
        },
        paymentModes: ["PAY_NOW", "PAY_LATER"],
    };
};

export const createBookingEntry = async ({
    userId,
    serviceCenterId,
    vehicleId,
    serviceId,
    subServiceId,
    serviceOptionId,
    bookingDate,
    bookingTimeSlot,
    paymentMode,
    couponCode = null,
    notes = null,
}) => {
    const review = await reviewBookingData({
        userId,
        serviceCenterId,
        vehicleId,
        serviceId,
        subServiceId,
        serviceOptionId,
        bookingDate,
        bookingTimeSlot,
        couponCode,
    });
    if (review.status !== "ok") return review;

    const matchedSlot = findMatchingSlot(bookingTimeSlot);
    const mode = String(paymentMode ?? "").trim().toUpperCase();
    if (mode !== "PAY_NOW" && mode !== "PAY_LATER") {
        return { status: "invalid_payment_mode" };
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Serialize booking creation per service center to prevent race conditions on time slots
        await client.query(
            `SELECT service_center_id FROM service_centers WHERE service_center_id=$1 FOR UPDATE`,
            [serviceCenterId]
        );

        const slotBookings = await client.query(
            `SELECT booking_id
             FROM service_bookings
             WHERE service_center_id=$1 AND booking_date=$2
               AND (booking_time_slot=$3 OR slot_start_time=$4)
               AND booking_status NOT IN ('CANCELLED')`,
            [serviceCenterId, bookingDate, matchedSlot.display, matchedSlot.startTime]
        );

        if (slotBookings.rowCount >= 2) {
            await client.query("ROLLBACK");
            return { status: "slot_not_available" };
        }

        const dateCompact = bookingDate.replace(/-/g, "");
        const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
        const bookingNumber = `BK${dateCompact}${randomHex}`;

        let couponId = null;
        if (review.pricing.coupon?.couponCode) {
            const couponRow = await client.query(
                "SELECT id FROM coupons WHERE UPPER(code)=$1",
                [review.pricing.coupon.couponCode.toUpperCase()]
            );
            if (couponRow.rowCount) {
                couponId = couponRow.rows[0].id;
            }
        }

        const insertResult = await client.query(
            `INSERT INTO service_bookings (
                booking_number, user_id, service_center_id, vehicle_id,
                service_id, sub_service_id, service_option_id,
                booking_date, booking_time_slot, slot_start_time, slot_end_time,
                base_price, delivery_charge, commission_amount, discount_amount, final_amount,
                coupon_id, coupon_code, payment_mode, payment_status, booking_status, notes
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
            ) RETURNING booking_id, booking_number, created_at`,
            [
                bookingNumber,
                userId,
                serviceCenterId,
                vehicleId,
                serviceId,
                subServiceId,
                serviceOptionId,
                bookingDate,
                matchedSlot.display,
                matchedSlot.startTime,
                matchedSlot.endTime,
                review.pricing.basePrice,
                review.pricing.deliveryCharge,
                review.pricing.commissionAmount,
                review.pricing.discountAmount,
                review.pricing.finalAmount,
                couponId,
                review.pricing.coupon?.couponCode ?? null,
                mode,
                "PENDING",
                mode === "PAY_NOW" ? "PENDING" : "CONFIRMED",
                notes,
            ]
        );

        await client.query("COMMIT");
        const created = insertResult.rows[0];

        return {
            status: "ok",
            booking: {
                bookingId: created.booking_id,
                bookingNumber: created.booking_number,
                bookingStatus: "CONFIRMED",
                bookingDate,
                bookingTimeSlot: matchedSlot.display,
                serviceCenter: {
                    serviceCenterId: review.serviceCenter.serviceCenterId,
                    name: review.serviceCenter.name,
                    address: review.serviceCenter.address,
                    serviceCenterImage: review.serviceCenter.serviceCenterImage,
                },
                vehicle: {
                    vehicleId: review.vehicle.vehicleId,
                    vehicleNumber: review.vehicle.vehicleNumber,
                    companyName: review.vehicle.companyName,
                    modelName: review.vehicle.modelName,
                },
                service: {
                    serviceName: review.service.serviceName,
                    subServiceName: review.service.subServiceName,
                    serviceOptionName: review.service.serviceOptionName,
                },
                pricing: {
                    basePrice: review.pricing.basePrice,
                    deliveryCharge: review.pricing.deliveryCharge,
                    deliveryType: review.pricing.deliveryType,
                    commissionAmount: review.pricing.commissionAmount,
                    subtotal: review.pricing.subtotal,
                    discountAmount: review.pricing.discountAmount,
                    couponCode: review.pricing.coupon?.couponCode ?? null,
                    finalAmount: review.pricing.finalAmount,
                },
                paymentMode: mode,
                paymentStatus: "PENDING",
                bookingStatus: mode === "PAY_NOW" ? "PENDING" : "CONFIRMED",
                notes,
                createdAt: created.created_at,
            },
        };
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
};

export const cancelUserBooking = async ({ userId, bookingId, cancellationReason = "Cancelled by user" }) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const bookingRes = await client.query(
            `SELECT booking_id, booking_number, booking_status, service_center_id
             FROM service_bookings
             WHERE booking_id=$1 AND user_id=$2 FOR UPDATE`,
            [bookingId, userId]
        );
        if (!bookingRes.rowCount) {
            await client.query("ROLLBACK");
            return { status: "not_found" };
        }
        const booking = bookingRes.rows[0];
        if (booking.booking_status === "CANCELLED") {
            await client.query("ROLLBACK");
            return { status: "already_cancelled" };
        }
        if (booking.booking_status === "COMPLETED") {
            await client.query("ROLLBACK");
            return { status: "cannot_cancel_completed" };
        }

        await client.query(
            `UPDATE service_bookings
             SET booking_status='CANCELLED', cancellation_reason=$1, cancelled_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
             WHERE booking_id=$2`,
            [cancellationReason, bookingId]
        );
        await client.query("COMMIT");
        return {
            status: "ok",
            bookingId: Number(booking.booking_id),
            bookingNumber: booking.booking_number,
            serviceCenterId: Number(booking.service_center_id),
            bookingStatus: "CANCELLED",
        };
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

const formatDateOnly = (d) => {
    if (!d) return "";
    if (typeof d === "string") return d.split("T")[0];
    if (d instanceof Date) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
    return String(d);
};

const mapBookingRow = (row) => {
    const now = new Date();
    const todayStr = formatDateOnly(now);
    const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;
    const bDate = formatDateOnly(row.bookingDate);

    const isPast =
        ["COMPLETED", "CANCELLED"].includes(row.bookingStatus) ||
        bDate < todayStr ||
        (bDate === todayStr && String(row.slotEndTime ?? "") <= currentTimeStr);

    const tag = isPast ? "PAST" : "UPCOMING";

    return {
        bookingId: Number(row.bookingId),
        bookingNumber: row.bookingNumber,
        tag,
        bookingStatus: row.bookingStatus,
        bookingDate: bDate,
        bookingTimeSlot: row.bookingTimeSlot,
        slotStartTime: row.slotStartTime,
        slotEndTime: row.slotEndTime,
        serviceCenter: {
            serviceCenterId: Number(row.serviceCenterId),
            name: row.serviceCenterName,
            address: [row.address_line_1, row.address_line_2, row.city, row.state, row.pincode].filter(Boolean).join(", "),
            serviceCenterImage: row.serviceCenterImage,
        },
        vehicle: {
            vehicleId: Number(row.vehicleId),
            vehicleNumber: row.vehicleNumber,
            companyName: row.companyName,
            modelName: row.modelName,
        },
        service: {
            serviceName: row.serviceName,
            subServiceName: row.subServiceName,
            serviceOptionName: row.serviceOptionName,
        },
        pricing: {
            basePrice: Number(row.basePrice || 0),
            deliveryCharge: Number(row.deliveryCharge || 0),
            commissionAmount: Number(row.commissionAmount || 0),
            discountAmount: Number(row.discountAmount || 0),
            couponCode: row.couponCode,
            finalAmount: Number(row.finalAmount || 0),
        },
        paymentMode: row.paymentMode,
        paymentStatus: row.paymentStatus,
        notes: row.notes,
        createdAt: row.createdAt,
    };
};

export const getUserBookings = async (userId, type = null) => {
    const result = await pool.query(
        `SELECT b.booking_id AS "bookingId", b.booking_number AS "bookingNumber",
                TO_CHAR(b.booking_date, 'YYYY-MM-DD') AS "bookingDate", b.booking_time_slot AS "bookingTimeSlot",
                b.slot_start_time AS "slotStartTime", b.slot_end_time AS "slotEndTime",
                b.base_price AS "basePrice",
                COALESCE(b.delivery_charge, 0) AS "deliveryCharge",
                COALESCE(b.commission_amount, 0) AS "commissionAmount",
                b.discount_amount AS "discountAmount",
                b.final_amount AS "finalAmount", b.coupon_code AS "couponCode",
                b.payment_mode AS "paymentMode", b.payment_status AS "paymentStatus",
                b.booking_status AS "bookingStatus", b.notes AS "notes", b.created_at AS "createdAt",
                c.service_center_id AS "serviceCenterId", c.service_center_name AS "serviceCenterName",
                c.service_center_pic_url AS "serviceCenterImage",
                c.address_line_1, c.address_line_2, c.city, c.state, c.pincode,
                s.service_name AS "serviceName", sub.sub_service_name AS "subServiceName",
                opt.service_option_name AS "serviceOptionName",
                uv.vehicle_id AS "vehicleId", uv.vehicle_number AS "vehicleNumber",
                COALESCE(bikeComp.company_name, carComp.company_name) AS "companyName",
                COALESCE(bikeMod.model_name, carMod.model_name) AS "modelName"
         FROM service_bookings b
         JOIN service_centers c ON c.service_center_id=b.service_center_id
         JOIN service_types s ON s.service_id=b.service_id
         JOIN service_sub_types sub ON sub.sub_service_id=b.sub_service_id
         JOIN service_options opt ON opt.service_option_id=b.service_option_id
         LEFT JOIN user_vehicle_details uv ON uv.vehicle_id=b.vehicle_id
         LEFT JOIN bike_companies bikeComp ON bikeComp.bike_company_id=uv.bike_company_id
         LEFT JOIN car_companies carComp ON carComp.car_company_id=uv.car_company_id
         LEFT JOIN bike_models bikeMod ON bikeMod.bike_model_id=uv.bike_model_id
         LEFT JOIN car_models carMod ON carMod.car_model_id=uv.car_model_id
         WHERE b.user_id=$1
         ORDER BY b.booking_date DESC, b.slot_start_time DESC, b.created_at DESC`,
        [userId]
    );

    const mapped = result.rows.map(mapBookingRow);
    const upcoming = mapped.filter((item) => item.tag === "UPCOMING");
    const past = mapped.filter((item) => item.tag === "PAST");

    const cleanType = String(type ?? "").trim().toLowerCase();
    if (cleanType === "upcoming") {
        return { count: upcoming.length, bookings: upcoming };
    }
    if (cleanType === "past") {
        return { count: past.length, bookings: past };
    }

    return {
        upcomingCount: upcoming.length,
        pastCount: past.length,
        upcoming,
        past,
        all: mapped,
    };
};

export const getUserBookingById = async (userId, bookingId) => {
    const result = await pool.query(
        `SELECT b.booking_id AS "bookingId", b.booking_number AS "bookingNumber",
                TO_CHAR(b.booking_date, 'YYYY-MM-DD') AS "bookingDate", b.booking_time_slot AS "bookingTimeSlot",
                b.slot_start_time AS "slotStartTime", b.slot_end_time AS "slotEndTime",
                b.base_price AS "basePrice",
                COALESCE(b.delivery_charge, 0) AS "deliveryCharge",
                COALESCE(b.commission_amount, 0) AS "commissionAmount",
                b.discount_amount AS "discountAmount",
                b.final_amount AS "finalAmount", b.coupon_code AS "couponCode",
                b.payment_mode AS "paymentMode", b.payment_status AS "paymentStatus",
                b.booking_status AS "bookingStatus", b.notes AS "notes", b.created_at AS "createdAt",
                c.service_center_id AS "serviceCenterId", c.service_center_name AS "serviceCenterName",
                c.service_center_pic_url AS "serviceCenterImage",
                c.address_line_1, c.address_line_2, c.city, c.state, c.pincode,
                s.service_name AS "serviceName", sub.sub_service_name AS "subServiceName",
                opt.service_option_name AS "serviceOptionName",
                uv.vehicle_id AS "vehicleId", uv.vehicle_number AS "vehicleNumber",
                COALESCE(bikeComp.company_name, carComp.company_name) AS "companyName",
                COALESCE(bikeMod.model_name, carMod.model_name) AS "modelName"
         FROM service_bookings b
         JOIN service_centers c ON c.service_center_id=b.service_center_id
         JOIN service_types s ON s.service_id=b.service_id
         JOIN service_sub_types sub ON sub.sub_service_id=b.sub_service_id
         JOIN service_options opt ON opt.service_option_id=b.service_option_id
         LEFT JOIN user_vehicle_details uv ON uv.vehicle_id=b.vehicle_id
         LEFT JOIN bike_companies bikeComp ON bikeComp.bike_company_id=uv.bike_company_id
         LEFT JOIN car_companies carComp ON carComp.car_company_id=uv.car_company_id
         LEFT JOIN bike_models bikeMod ON bikeMod.bike_model_id=uv.bike_model_id
         LEFT JOIN car_models carMod ON carMod.car_model_id=uv.car_model_id
         WHERE b.user_id=$1 AND b.booking_id=$2`,
        [userId, bookingId]
    );

    if (!result.rowCount) return null;
    return mapBookingRow(result.rows[0]);
};
