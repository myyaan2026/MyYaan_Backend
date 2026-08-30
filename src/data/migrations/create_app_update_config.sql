CREATE TABLE IF NOT EXISTS app_update_config (
    device_type VARCHAR(20) PRIMARY KEY,
    minimum_supported_version VARCHAR(50) NOT NULL,
    latest_version VARCHAR(50) NOT NULL,
    minimum_supported_build INTEGER,
    latest_build INTEGER,
    force_update_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    store_url TEXT,
    update_message TEXT NOT NULL DEFAULT 'A new version of MyYaan is available.',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT app_update_config_device_type_check CHECK (device_type IN ('android', 'ios'))
);

INSERT INTO app_update_config
    (device_type, minimum_supported_version, latest_version, force_update_enabled)
VALUES
    ('android', '1.0.0', '1.0.0', FALSE),
    ('ios', '1.0.0', '1.0.0', FALSE)
ON CONFLICT (device_type) DO NOTHING;

