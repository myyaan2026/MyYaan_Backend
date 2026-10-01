CREATE TABLE IF NOT EXISTS service_center_pricing (
    pricing_id SERIAL PRIMARY KEY,
    service_center_id BIGINT NOT NULL REFERENCES service_centers(service_center_id) ON DELETE CASCADE,
    service_id BIGINT NOT NULL REFERENCES service_types(service_id) ON DELETE CASCADE,
    walk_in_price NUMERIC(10,2) NOT NULL DEFAULT 200.00,
    pick_drop_charge NUMERIC(10,2) NOT NULL DEFAULT 200.00,
    home_service_price NUMERIC(10,2) NOT NULL DEFAULT 500.00,
    commission_amount NUMERIC(10,2) NOT NULL DEFAULT 50.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT service_center_pricing_center_service_key UNIQUE (service_center_id, service_id)
);

CREATE INDEX IF NOT EXISTS service_center_pricing_center_service_idx
    ON service_center_pricing (service_center_id, service_id);

ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Seed default pricing for existing active service centers
INSERT INTO service_center_pricing (service_center_id, service_id, walk_in_price, pick_drop_charge, home_service_price, commission_amount)
SELECT center.service_center_id, service.service_id, 200.00, 200.00, 500.00, 50.00
FROM service_centers center
CROSS JOIN service_types service
WHERE center.is_active = TRUE
ON CONFLICT (service_center_id, service_id) DO NOTHING;
