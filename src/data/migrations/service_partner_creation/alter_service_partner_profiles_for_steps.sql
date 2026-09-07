ALTER TABLE service_partner_profiles ALTER COLUMN profile_pic_url DROP NOT NULL;
ALTER TABLE service_partner_profiles ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE service_partner_profiles ALTER COLUMN last_name DROP NOT NULL;
ALTER TABLE service_partner_profiles ALTER COLUMN email DROP NOT NULL;
ALTER TABLE service_partner_profiles ALTER COLUMN service_center_name DROP NOT NULL;
ALTER TABLE service_partner_profiles ALTER COLUMN address_line_1 DROP NOT NULL;
ALTER TABLE service_partner_profiles ALTER COLUMN city DROP NOT NULL;
ALTER TABLE service_partner_profiles ALTER COLUMN state DROP NOT NULL;
ALTER TABLE service_partner_profiles ALTER COLUMN pincode DROP NOT NULL;
ALTER TABLE service_partner_profiles ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE service_partner_profiles ALTER COLUMN longitude DROP NOT NULL;
ALTER TABLE service_partner_profiles ALTER COLUMN service_center_pic_url DROP NOT NULL;

ALTER TABLE service_partner_profiles
    ADD COLUMN IF NOT EXISTS is_personal_details_completed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_service_center_details_completed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_services_completed BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
    ALTER TABLE service_partner_profiles ADD CONSTRAINT service_partner_profiles_location_pair_check
        CHECK ((latitude IS NULL AND longitude IS NULL) OR
               (latitude IS NOT NULL AND longitude IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

