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
                 payment_mode = CASE 
                     WHEN payment_mode IS NULL OR payment_mode = 'PAY_NOW' THEN 'ONLINE'
                     ELSE payment_mode
                 END,
                 paid_amount = final_amount,
                 due_amount = 0.00,
                 booking_status = CASE 
                     WHEN booking_status = 'COMPLETED' THEN 'COMPLETED'
                     WHEN booking_status = 'IN_PROGRESS' THEN 'IN_PROGRESS'
                     ELSE 'CONFIRMED'
                 END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE booking_id = $1
             RETURNING booking_id, booking_number, user_id, service_center_id,
                       booking_date, booking_time_slot, base_price, delivery_charge,
                       extra_amount, commission_amount, discount_amount, final_amount,
                       paid_amount, due_amount, payment_mode, payment_status, booking_status`,
            [payment.booking_id]
        );

        const updatedBk = bookingRes.rows[0];
        // If booking is completed, settle partner wallet
        if (updatedBk && updatedBk.booking_status === "COMPLETED") {
            const partnerShare = Number((Number(updatedBk.base_price || 0) + Number(updatedBk.delivery_charge || 0) + Number(updatedBk.extra_amount || 0)).toFixed(2));
            const cashRes = await client.query(
                `SELECT COALESCE(SUM(amount), 0)::numeric AS total_cash FROM booking_payments WHERE booking_id = $1 AND gateway = 'CASH' AND status = 'PAID'`,
                [payment.booking_id]
            );
            const cashCollected = Number(cashRes.rows[0]?.total_cash || 0);
            const targetWallet = Math.max(0, Number((partnerShare - cashCollected).toFixed(2)));

            const wRes = await client.query(
                `SELECT COALESCE(SUM(CASE WHEN transaction_type = 'CREDIT' THEN amount ELSE 0 END), 0)::numeric AS credited FROM partner_wallet_transactions WHERE booking_id = $1`,
                [payment.booking_id]
            );
            const prevCredited = Number(wRes.rows[0]?.credited || 0);
            const delta = Number((targetWallet - prevCredited).toFixed(2));
            if (delta > 0) {
                const pwRes = await client.query(
                    `INSERT INTO partner_wallets (service_center_id, balance, total_earned)
                     VALUES ($1, $2, $2)
                     ON CONFLICT (service_center_id)
                     DO UPDATE SET balance = partner_wallets.balance + $2,
                                   total_earned = partner_wallets.total_earned + $2,
                                   updated_at = CURRENT_TIMESTAMP
                     RETURNING wallet_id, balance`,
                    [updatedBk.service_center_id, delta]
                );
                const wallet = pwRes.rows[0];
                const closingBalance = Number(wallet.balance);
                const openingBalance = Number((closingBalance - delta).toFixed(2));

                await client.query(
                    `INSERT INTO partner_wallet_transactions
                        (wallet_id, service_center_id, booking_id, transaction_type, amount, opening_balance, closing_balance, tag, description)
                     VALUES ($1, $2, $3, 'CREDIT', $4, $5, $6, 'SERVICE_EARNING', $7)`,
                    [
                        wallet.wallet_id,
                        updatedBk.service_center_id,
                        updatedBk.booking_id,
                        delta,
                        openingBalance,
                        closingBalance,
                        `Online payment earning for booking #${updatedBk.booking_number} (Partner share: ₹${partnerShare.toFixed(2)}, Credited: ₹${delta.toFixed(2)})`
                    ]
                );
            }
        }

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

