ALTER TABLE auth_sessions
    ADD COLUMN IF NOT EXISTS device_id BIGINT;

DO $$ BEGIN
    ALTER TABLE auth_sessions
        ADD CONSTRAINT auth_sessions_device_id_fkey
        FOREIGN KEY (device_id) REFERENCES user_device_details(device_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS auth_sessions_device_id_idx
    ON auth_sessions (device_id);

CREATE INDEX IF NOT EXISTS user_device_details_notification_targets_idx
    ON user_device_details (user_id)
    WHERE is_active = TRUE
      AND notifications_enabled = TRUE
      AND push_token IS NOT NULL;
