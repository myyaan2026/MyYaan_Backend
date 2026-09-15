-- A service centre may offer only selected delivery modes for a service.
ALTER TABLE service_sub_types DROP CONSTRAINT IF EXISTS service_sub_types_id_service_key;
ALTER TABLE service_sub_types ADD CONSTRAINT service_sub_types_id_service_key
    UNIQUE (sub_service_id, service_id);

CREATE TABLE IF NOT EXISTS service_center_sub_services (
    service_center_id BIGINT NOT NULL,
    service_id BIGINT NOT NULL,
    sub_service_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (service_center_id, service_id, sub_service_id),
    FOREIGN KEY (service_center_id, service_id)
        REFERENCES service_center_services(service_center_id, service_type_id) ON DELETE CASCADE,
    FOREIGN KEY (sub_service_id, service_id)
        REFERENCES service_sub_types(sub_service_id, service_id)
);
CREATE INDEX IF NOT EXISTS service_center_sub_services_sub_service_idx
    ON service_center_sub_services (service_id, sub_service_id);

-- Existing active service offers support every currently-enabled delivery mode.
-- Partners can narrow this set through the capability API.
INSERT INTO service_center_sub_services (service_center_id, service_id, sub_service_id)
SELECT mapping.service_center_id, mapping.service_type_id, sub.sub_service_id
FROM service_center_services mapping
JOIN service_sub_types sub ON sub.service_id=mapping.service_type_id AND sub.is_enabled=TRUE
ON CONFLICT DO NOTHING;
