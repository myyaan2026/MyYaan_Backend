CREATE TABLE IF NOT EXISTS user_device_details (
    device_id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    device_token UUID NOT NULL UNIQUE,
    device_type VARCHAR(20) NOT NULL,
    device_name VARCHAR(150),
    app_version VARCHAR(50) NOT NULL,
    build_number INTEGER,
    push_token TEXT,
    push_provider VARCHAR(20),
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_device_details_device_type_check CHECK (device_type IN ('android', 'ios')),
    CONSTRAINT user_device_details_push_provider_check
        CHECK (push_provider IS NULL OR push_provider IN ('fcm', 'apns', 'other')),
    CONSTRAINT user_device_details_push_pair_check
        CHECK ((push_token IS NULL AND push_provider IS NULL) OR
               (push_token IS NOT NULL AND push_provider IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS user_device_details_user_id_idx
    ON user_device_details (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_device_details_push_token_key
    ON user_device_details (push_token) WHERE push_token IS NOT NULL;
