ALTER TABLE otp_codes DROP COLUMN IF EXISTS device_registration_token_hash;
ALTER TABLE otp_codes DROP COLUMN IF EXISTS device_registration_expires_at;

