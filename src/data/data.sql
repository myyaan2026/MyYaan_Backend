-- Run this file against the PostgreSQL database configured in .env.

CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (code, name) VALUES
    ('user', 'User'),
    ('service_partner', 'Service Partner'),
    ('admin', 'Admin')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    mobile VARCHAR(15) NOT NULL,
    role_id BIGINT NOT NULL REFERENCES roles(id),
    is_mobile_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_login_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_profile_updated BOOLEAN NOT NULL DEFAULT FALSE,
    email VARCHAR(255),
    name VARCHAR(150),
    service_center_name VARCHAR(255),
    address_line_1 VARCHAR(255),
    address_line_2 VARCHAR(255),
    city VARCHAR(100),
    pincode VARCHAR(6),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (mobile, role_id)
);

-- Profile and account-state migration for existing databases.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_login_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_profile_updated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_center_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line_1 VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line_2 VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pincode VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);
UPDATE users SET is_verified = is_mobile_verified WHERE is_mobile_verified = TRUE;
DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT users_pincode_format_check CHECK (pincode IS NULL OR pincode ~ '^[0-9]{6}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT users_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT users_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Migration for databases created with the earlier mobile-only users table.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id BIGINT;
UPDATE users SET role_id = (SELECT id FROM roles WHERE code = 'user') WHERE role_id IS NULL;
ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_mobile_key;
-- These indexes are required by the UPSERTs in userModel.js.  CREATE TABLE
-- IF NOT EXISTS does not add them when `users`/`otp_codes` already exist.
CREATE UNIQUE INDEX IF NOT EXISTS users_mobile_role_id_key ON users (mobile, role_id);
DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS otp_codes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mobile VARCHAR(15) NOT NULL,
    role_id BIGINT NOT NULL REFERENCES roles(id),
    otp_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migration for existing OTP rows.
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS role_id BIGINT;
UPDATE otp_codes SET role_id = (SELECT id FROM roles WHERE code = 'user') WHERE role_id IS NULL;
ALTER TABLE otp_codes ALTER COLUMN role_id SET NOT NULL;
DO $$ BEGIN
    ALTER TABLE otp_codes ADD CONSTRAINT otp_codes_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DELETE FROM otp_codes AS unmapped
USING users, otp_codes AS mapped
WHERE unmapped.user_id IS NULL
  AND users.mobile = unmapped.mobile
  AND users.role_id = unmapped.role_id
  AND mapped.user_id = users.id;
UPDATE otp_codes AS otp
SET user_id = users.id
FROM users
WHERE otp.user_id IS NULL
  AND users.mobile = otp.mobile
  AND users.role_id = otp.role_id;
-- Unmapped legacy OTPs cannot be used by the new user-linked flow.
DELETE FROM otp_codes WHERE user_id IS NULL;
ALTER TABLE otp_codes ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS otp_codes_mobile_role_created_at_idx
    ON otp_codes (mobile, role_id, created_at DESC);

-- Keep one reusable OTP row per user. Preserve the newest legacy row.
DELETE FROM otp_codes older USING otp_codes newer
WHERE older.user_id = newer.user_id AND older.user_id IS NOT NULL
  AND (older.created_at, older.id) < (newer.created_at, newer.id);
CREATE UNIQUE INDEX IF NOT EXISTS otp_codes_user_id_key ON otp_codes (user_id);

-- Verify the two conflict targets used by createOtp:
--   users(mobile, role_id) and otp_codes(user_id)
