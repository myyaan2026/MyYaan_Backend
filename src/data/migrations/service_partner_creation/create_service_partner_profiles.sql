CREATE TABLE IF NOT EXISTS service_partner_profiles (
    profile_id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    profile_pic_url TEXT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    alternative_mobile VARCHAR(15),
    service_center_name VARCHAR(255) NOT NULL,
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    service_center_pic_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT service_partner_profiles_alternative_mobile_check
        CHECK (alternative_mobile IS NULL OR alternative_mobile ~ '^[0-9]{7,15}$'),
    CONSTRAINT service_partner_profiles_pincode_check CHECK (pincode ~ '^[0-9]{6}$'),
    CONSTRAINT service_partner_profiles_latitude_check CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT service_partner_profiles_longitude_check CHECK (longitude BETWEEN -180 AND 180)
);

CREATE TABLE IF NOT EXISTS service_partner_services (
    profile_id BIGINT NOT NULL REFERENCES service_partner_profiles(profile_id) ON DELETE CASCADE,
    service_type_id INTEGER NOT NULL REFERENCES service_types(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (profile_id, service_type_id)
);

CREATE INDEX IF NOT EXISTS service_partner_services_service_type_id_idx
    ON service_partner_services (service_type_id);
