CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    profile_pic_url TEXT,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    alternative_mobile VARCHAR(15),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_profiles_alternative_mobile_check
        CHECK (alternative_mobile IS NULL OR alternative_mobile ~ '^[0-9]{7,15}$')
);

CREATE TABLE IF NOT EXISTS user_addresses (
    address_id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    address_label VARCHAR(50),
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_addresses_pincode_check CHECK (pincode ~ '^[0-9]{6}$'),
    CONSTRAINT user_addresses_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT user_addresses_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CONSTRAINT user_addresses_location_pair_check CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude IS NOT NULL AND longitude IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS user_addresses_user_id_idx ON user_addresses (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_one_default_per_user_idx
    ON user_addresses (user_id) WHERE is_default = TRUE AND is_active = TRUE;

CREATE TABLE IF NOT EXISTS service_partner_onboarding (
    user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    is_personal_details_completed BOOLEAN NOT NULL DEFAULT FALSE,
    is_service_center_details_completed BOOLEAN NOT NULL DEFAULT FALSE,
    is_services_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_centers (
    service_center_id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    service_center_name VARCHAR(255) NOT NULL,
    service_center_pic_url TEXT,
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT service_centers_pincode_check CHECK (pincode ~ '^[0-9]{6}$'),
    CONSTRAINT service_centers_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT service_centers_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CONSTRAINT service_centers_location_pair_check CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude IS NOT NULL AND longitude IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS service_centers_user_id_idx ON service_centers (user_id);

CREATE TABLE IF NOT EXISTS service_center_services (
    service_center_id BIGINT NOT NULL REFERENCES service_centers(service_center_id) ON DELETE CASCADE,
    service_type_id BIGINT NOT NULL REFERENCES service_types(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (service_center_id, service_type_id)
);

CREATE INDEX IF NOT EXISTS service_center_services_service_type_id_idx
    ON service_center_services (service_type_id);

-- Preserve any data from the earlier combined service-partner profile table.
INSERT INTO user_profiles
    (user_id, profile_pic_url, first_name, last_name, email, alternative_mobile, is_completed)
SELECT user_id, profile_pic_url, first_name, last_name, email, alternative_mobile,
       is_personal_details_completed
FROM service_partner_profiles
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO service_partner_onboarding
    (user_id, is_personal_details_completed,
     is_service_center_details_completed, is_services_completed)
SELECT user_id, is_personal_details_completed,
       is_service_center_details_completed, is_services_completed
FROM service_partner_profiles
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO service_centers
    (service_center_id, user_id, service_center_name, service_center_pic_url,
     address_line_1, address_line_2, city, state, pincode, latitude, longitude)
SELECT profile_id, user_id, service_center_name, service_center_pic_url,
       address_line_1, address_line_2, city, state, pincode, latitude, longitude
FROM service_partner_profiles
WHERE is_service_center_details_completed = TRUE
ON CONFLICT (service_center_id) DO NOTHING;

INSERT INTO service_center_services (service_center_id, service_type_id)
SELECT mapping.profile_id, mapping.service_type_id
FROM service_partner_services mapping
JOIN service_centers center ON center.service_center_id = mapping.profile_id
ON CONFLICT DO NOTHING;

SELECT setval(
    pg_get_serial_sequence('service_centers', 'service_center_id'),
    COALESCE((SELECT MAX(service_center_id) FROM service_centers), 1),
    EXISTS (SELECT 1 FROM service_centers)
);

DROP TABLE service_partner_services;
DROP TABLE service_partner_profiles;

-- Authentication/account data stays in users; profile/address data moves out.
ALTER TABLE users DROP COLUMN IF EXISTS email;
ALTER TABLE users DROP COLUMN IF EXISTS name;
ALTER TABLE users DROP COLUMN IF EXISTS service_center_name;
ALTER TABLE users DROP COLUMN IF EXISTS address_line_1;
ALTER TABLE users DROP COLUMN IF EXISTS address_line_2;
ALTER TABLE users DROP COLUMN IF EXISTS city;
ALTER TABLE users DROP COLUMN IF EXISTS pincode;
ALTER TABLE users DROP COLUMN IF EXISTS latitude;
ALTER TABLE users DROP COLUMN IF EXISTS longitude;

