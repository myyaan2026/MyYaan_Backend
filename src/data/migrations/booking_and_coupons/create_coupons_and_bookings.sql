CREATE TABLE IF NOT EXISTS coupons (
    coupon_id SERIAL PRIMARY KEY,
    coupon_code VARCHAR(30) UNIQUE NOT NULL,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
    discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
    min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
    max_discount_amount NUMERIC(10,2) DEFAULT NULL,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_bookings (
    booking_id SERIAL PRIMARY KEY,
    booking_number VARCHAR(40) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    service_center_id BIGINT NOT NULL REFERENCES service_centers(service_center_id),
    vehicle_id INTEGER NOT NULL,
    service_id BIGINT NOT NULL REFERENCES service_types(service_id),
    sub_service_id INTEGER NOT NULL REFERENCES service_sub_types(sub_service_id),
    service_option_id INTEGER NOT NULL REFERENCES service_options(service_option_id),
    booking_date DATE NOT NULL,
    booking_time_slot VARCHAR(50) NOT NULL,
    slot_start_time TIME NOT NULL,
    slot_end_time TIME NOT NULL,
    base_price NUMERIC(10,2) NOT NULL,
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    final_amount NUMERIC(10,2) NOT NULL,
    coupon_id INTEGER REFERENCES coupons(coupon_id),
    coupon_code VARCHAR(30),
    payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('PAY_NOW', 'PAY_LATER')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    booking_status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (booking_status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS service_bookings_center_date_idx
    ON service_bookings (service_center_id, booking_date, booking_status);

CREATE INDEX IF NOT EXISTS service_bookings_user_id_idx
    ON service_bookings (user_id, created_at DESC);

INSERT INTO coupons (coupon_code, title, description, discount_type, discount_value, min_order_amount, max_discount_amount)
VALUES
    ('FIRST50', 'First Ride Special', '50% off up to ₹150 on your first booking', 'PERCENTAGE', 50.00, 299.00, 150.00),
    ('MYYAAN100', 'Flat ₹100 Off', 'Flat ₹100 discount on bookings above ₹499', 'FLAT', 100.00, 499.00, NULL),
    ('FESTIVE20', 'Festive Offer', '20% off up to ₹300 on bookings above ₹599', 'PERCENTAGE', 20.00, 599.00, 300.00),
    ('SAVE200', 'Mega Savings', 'Flat ₹200 discount on bookings above ₹999', 'FLAT', 200.00, 999.00, NULL)
ON CONFLICT (coupon_code) DO NOTHING;
