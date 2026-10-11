import pool from "../../config/db.js";

/**
 * Insert a newly generated Razorpay order into booking_payments
 */
export const insertPaymentOrder = async ({
    bookingId,
    userId,
    razorpayOrderId,
    amount,
    currency = "INR",
    metadata = null,
}) => {
    const result = await pool.query(
        `INSERT INTO booking_payments (
            booking_id, user_id, gateway, razorpay_order_id, amount, currency, status, notes
        ) VALUES ($1, $2, 'RAZORPAY', $3, $4, $5, 'CREATED', $6)
        ON CONFLICT (razorpay_order_id) DO UPDATE SET
            amount = EXCLUDED.amount,
            updated_at = CURRENT_TIMESTAMP
        RETURNING payment_id AS "paymentId",
                  booking_id AS "bookingId",
                  user_id AS "userId",
                  gateway,
                  razorpay_order_id AS "razorpayOrderId",
                  amount,
                  currency,
                  status,
                  created_at AS "createdAt"`,
        [bookingId, userId, razorpayOrderId, amount, currency, metadata ? JSON.stringify(metadata) : null]
    );
    return result.rows[0];
};

/**
 * Find payment record by Razorpay order ID
 */
export const getPaymentByRazorpayOrderId = async (razorpayOrderId) => {
    const result = await pool.query(
        `SELECT payment_id AS "paymentId",
                booking_id AS "bookingId",
                user_id AS "userId",
                gateway,
                razorpay_order_id AS "razorpayOrderId",
                razorpay_payment_id AS "razorpayPaymentId",
                razorpay_signature AS "razorpaySignature",
                amount,
                currency,
                status,
                payment_method AS "paymentMethod",
                notes,
                created_at AS "createdAt",
                updated_at AS "updatedAt"
         FROM booking_payments
         WHERE razorpay_order_id = $1`,
        [razorpayOrderId]
    );
    return result.rows[0] ?? null;
};

/**
 * Find latest payment record by booking ID
 */
export const getLatestPaymentByBookingId = async (bookingId) => {
    const result = await pool.query(
        `SELECT payment_id AS "paymentId",
                booking_id AS "bookingId",
                user_id AS "userId",
                gateway,
                razorpay_order_id AS "razorpayOrderId",
                razorpay_payment_id AS "razorpayPaymentId",
                amount,
                currency,
                status,
                payment_method AS "paymentMethod",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
         FROM booking_payments
         WHERE booking_id = $1
         ORDER BY payment_id DESC
         LIMIT 1`,
        [bookingId]
    );
    return result.rows[0] ?? null;
};

/**
 * Mark payment as successfully verified & update booking status
 */
export const markPaymentSuccessful = async ({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    paymentMethod = null,
    metadata = null,
}) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const paymentRes = await client.query(
            `UPDATE booking_payments
             SET status = 'PAID',
                 razorpay_payment_id = $2,
                 razorpay_signature = $3,
                 payment_method = COALESCE($4, payment_method),
                 notes = COALESCE($5, notes),
                 updated_at = CURRENT_TIMESTAMP
             WHERE razorpay_order_id = $1
             RETURNING payment_id, booking_id, user_id, amount, currency, status`,
            [razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentMethod, metadata ? JSON.stringify(metadata) : null]
        );

        if (!paymentRes.rowCount) {
            await client.query("ROLLBACK");
            return { status: "payment_record_not_found" };
        }

        const payment = paymentRes.rows[0];

        // Update the booking record
        const bookingRes = await client.query(
            `UPDATE service_bookings
             SET payment_status = 'PAID',
                 booking_status = 'CONFIRMED',
                 updated_at = CURRENT_TIMESTAMP
             WHERE booking_id = $1
             RETURNING booking_id, booking_number, user_id, service_center_id,
                       booking_date, booking_time_slot, final_amount,
                       payment_mode, payment_status, booking_status`,
            [payment.booking_id]
        );

        await client.query("COMMIT");

        return {
            status: "ok",
            payment: {
                paymentId: payment.payment_id,
                bookingId: payment.booking_id,
                razorpayOrderId,
                razorpayPaymentId,
                amount: Number(payment.amount),
                currency: payment.currency,
                status: payment.status,
            },
            booking: bookingRes.rows[0],
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Record a payment failure
 */
export const markPaymentFailed = async ({
    razorpayOrderId,
    errorCode,
    errorDescription,
}) => {
    const result = await pool.query(
        `UPDATE booking_payments
         SET status = 'FAILED',
             error_code = $2,
             error_description = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE razorpay_order_id = $1
         RETURNING payment_id, booking_id, status`,
        [razorpayOrderId, errorCode, errorDescription]
    );

    if (result.rowCount) {
        await pool.query(
            `UPDATE service_bookings
             SET payment_status = 'FAILED',
                 updated_at = CURRENT_TIMESTAMP
             WHERE booking_id = $1 AND payment_status <> 'PAID'`,
            [result.rows[0].booking_id]
        );
    }

    return result.rows[0] ?? null;
};

