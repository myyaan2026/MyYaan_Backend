-- Add tag, tag_details, house_number, and landmark to user_addresses
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS tag VARCHAR(50) NOT NULL DEFAULT 'HOME';
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS tag_details VARCHAR(100);
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS house_number VARCHAR(100);
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS landmark VARCHAR(200);

-- Add tag check constraint to user_addresses
ALTER TABLE user_addresses DROP CONSTRAINT IF EXISTS user_addresses_tag_check;
ALTER TABLE user_addresses ADD CONSTRAINT user_addresses_tag_check
    CHECK (tag IN ('HOME', 'OFFICE', 'WORK', 'OTHER'));

-- Add account deletion requested timestamp to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ DEFAULT NULL;

-- Add address_id to service_bookings
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS address_id BIGINT;
