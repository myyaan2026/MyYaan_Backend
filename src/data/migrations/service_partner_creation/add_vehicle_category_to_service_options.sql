-- A shared service such as Puncture can have separate Bike and Car cards,
-- prices and checklists. The booking API filters these by the selected vehicle.
ALTER TABLE service_options ADD COLUMN IF NOT EXISTS vehicle_category VARCHAR(10) NOT NULL DEFAULT 'ANY';
ALTER TABLE service_options DROP CONSTRAINT IF EXISTS service_options_vehicle_category_check;
ALTER TABLE service_options ADD CONSTRAINT service_options_vehicle_category_check
    CHECK (vehicle_category IN ('BIKE', 'CAR', 'ANY'));
ALTER TABLE service_options DROP CONSTRAINT IF EXISTS service_options_service_code_key;
ALTER TABLE service_options ADD CONSTRAINT service_options_service_code_category_key
    UNIQUE (service_id, service_option_code, vehicle_category);
DROP INDEX IF EXISTS service_options_one_default_per_service_key;
CREATE UNIQUE INDEX IF NOT EXISTS service_options_one_default_per_service_category_key
    ON service_options (service_id, vehicle_category) WHERE is_default = TRUE;

-- Existing shared Running Repair and Puncture options become the Bike cards.
-- They inherit complete Bike Service metadata for every matching option.
UPDATE service_options target SET
    vehicle_category='BIKE', tags=source.tags, short_description=source.short_description,
    full_description=source.full_description, checklist=source.checklist,
    base_price=source.base_price, additional_charge_note=source.additional_charge_note,
    estimated_duration_minutes=source.estimated_duration_minutes,
    warranty_description=source.warranty_description, updated_at=CURRENT_TIMESTAMP
FROM service_types shared
JOIN service_types bike ON bike.service_code='BIKE_SERVICE'
JOIN service_options source ON source.service_id=bike.service_id
WHERE target.service_id=shared.service_id
  AND shared.service_code IN ('RUNNING_REPAIR','PUNCTURE')
  AND source.service_option_code=target.service_option_code
  AND target.vehicle_category='ANY';

-- Add equivalent Car cards for every shared service option. Its data is copied
-- from CAR_SERVICE, so the checklist and pricing can differ from Bike values.
INSERT INTO service_options
    (service_id, service_option_code, service_option_name, service_option_description,
     tags, short_description, full_description, checklist, base_price, additional_charge_note,
     estimated_duration_minutes, warranty_description, is_enabled, is_default, display_order, vehicle_category)
SELECT shared.service_id, source.service_option_code, source.service_option_name, source.service_option_description,
       source.tags, source.short_description, source.full_description, source.checklist,
       source.base_price, source.additional_charge_note, source.estimated_duration_minutes,
       source.warranty_description, source.is_enabled,
       source.service_option_code=CASE shared.service_code
           WHEN 'RUNNING_REPAIR' THEN 'RUNNING_REPAIR' WHEN 'PUNCTURE' THEN 'PUNCTURE' END,
       source.display_order, 'CAR'
FROM service_types shared
JOIN service_types car ON car.service_code='CAR_SERVICE'
JOIN service_options source ON source.service_id=car.service_id AND source.vehicle_category='ANY'
WHERE shared.service_code IN ('RUNNING_REPAIR','PUNCTURE')
ON CONFLICT (service_id, service_option_code, vehicle_category) DO UPDATE SET
    service_option_name=EXCLUDED.service_option_name,
    service_option_description=EXCLUDED.service_option_description,
    tags=EXCLUDED.tags, short_description=EXCLUDED.short_description,
    full_description=EXCLUDED.full_description, checklist=EXCLUDED.checklist,
    base_price=EXCLUDED.base_price, additional_charge_note=EXCLUDED.additional_charge_note,
    estimated_duration_minutes=EXCLUDED.estimated_duration_minutes,
    warranty_description=EXCLUDED.warranty_description, is_enabled=EXCLUDED.is_enabled,
    is_default=EXCLUDED.is_default, display_order=EXCLUDED.display_order,
    updated_at=CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS service_options_service_vehicle_category_idx
    ON service_options (service_id, vehicle_category, is_enabled, display_order);
