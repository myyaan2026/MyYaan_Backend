CREATE TABLE IF NOT EXISTS otp_codes (
    otp_id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    mobile VARCHAR(15) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(role_id),
    otp_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    device_registration_token_hash VARCHAR(64),
    device_registration_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT otp_codes_user_id_key UNIQUE (user_id)
);

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_codes' AND column_name = 'id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_codes' AND column_name = 'otp_id') THEN
        ALTER TABLE otp_codes RENAME COLUMN id TO otp_id;
    END IF;
END $$;

ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS role_id BIGINT;
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS device_registration_token_hash VARCHAR(64);
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS device_registration_expires_at TIMESTAMPTZ;
UPDATE otp_codes SET role_id = 1 WHERE role_id IS NULL;
ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS otp_codes_user_id_fkey;
ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS otp_codes_role_id_fkey;
ALTER TABLE otp_codes ALTER COLUMN user_id TYPE INTEGER USING user_id::INTEGER;
ALTER TABLE otp_codes ALTER COLUMN role_id TYPE INTEGER USING role_id::INTEGER;
ALTER TABLE otp_codes ALTER COLUMN role_id SET NOT NULL;
ALTER TABLE otp_codes ADD CONSTRAINT otp_codes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;
ALTER TABLE otp_codes ADD CONSTRAINT otp_codes_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES roles(role_id);
CREATE INDEX IF NOT EXISTS otp_codes_mobile_role_created_at_idx
    ON otp_codes (mobile, role_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS otp_codes_user_id_key ON otp_codes (user_id);
