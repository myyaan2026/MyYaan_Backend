DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'service_types' AND column_name = 'service_id') THEN
        ALTER TABLE service_types RENAME COLUMN service_id TO service_code;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'service_partner_services' AND column_name = 'service_id') THEN
        ALTER TABLE service_partner_services ADD COLUMN IF NOT EXISTS service_type_id BIGINT;
        EXECUTE 'UPDATE service_partner_services mapping
                 SET service_type_id = services.id
                 FROM service_types services
                 WHERE services.service_code = mapping.service_id
                   AND mapping.service_type_id IS NULL';
        ALTER TABLE service_partner_services ALTER COLUMN service_type_id SET NOT NULL;
        ALTER TABLE service_partner_services DROP CONSTRAINT IF EXISTS service_partner_services_pkey;
        ALTER TABLE service_partner_services DROP CONSTRAINT IF EXISTS service_partner_services_service_id_fkey;
        DROP INDEX IF EXISTS service_partner_services_service_id_idx;
        ALTER TABLE service_partner_services DROP COLUMN service_id;
        ALTER TABLE service_partner_services ADD CONSTRAINT service_partner_services_pkey
            PRIMARY KEY (profile_id, service_type_id);
        ALTER TABLE service_partner_services ADD CONSTRAINT service_partner_services_service_type_id_fkey
            FOREIGN KEY (service_type_id) REFERENCES service_types(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS service_partner_services_service_type_id_idx
    ON service_partner_services (service_type_id);

