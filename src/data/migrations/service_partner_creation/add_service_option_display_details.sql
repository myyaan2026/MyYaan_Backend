-- Presentation and checklist data for a selectable service option. TEXT[] is
-- returned by pg as a JSON string array, which is suitable for the app UI.
ALTER TABLE service_options ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE service_options ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE service_options ADD COLUMN IF NOT EXISTS full_description TEXT;
ALTER TABLE service_options ADD COLUMN IF NOT EXISTS checklist TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE service_options ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2);
ALTER TABLE service_options ADD COLUMN IF NOT EXISTS additional_charge_note TEXT;
ALTER TABLE service_options ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER;
ALTER TABLE service_options ADD COLUMN IF NOT EXISTS warranty_description TEXT;
ALTER TABLE service_options ADD CONSTRAINT service_options_base_price_check
    CHECK (base_price IS NULL OR base_price >= 0);
ALTER TABLE service_options ADD CONSTRAINT service_options_duration_check
    CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0);

-- Bike and car records are intentionally seeded separately because their
-- checklists, prices and supplementary work differ.
WITH details(service_code, option_code, tags, short_description, full_description, checklist, base_price, additional_charge_note, duration, warranty) AS (VALUES
    ('BIKE_SERVICE', 'GENERAL_SERVICE', ARRAY['Most Booked'],
        'Complete bike health check and routine maintenance.',
        'A comprehensive bike service covering safety checks, cleaning, lubrication and essential adjustments.',
        ARRAY['Air Filter Cleaning','Battery Voltage Check','Brakes Service','Cables & Levers Adjustment','Chain Tension Check','Clutch Greasing','Dry Wash','Electrical Check-up','Engine Oil Check','Greasing & Lubrication','Oil Leakage Check','Spark Plug Cleaning'],
        450, NULL, 120, '500 km / 1-month warranty'),
    ('BIKE_SERVICE', 'GENERAL_SERVICE_ENGINE_OIL', ARRAY['Best Value'],
        'General bike service with engine oil replacement.',
        'Complete routine bike service with fresh engine oil and a full safety inspection.',
        ARRAY['All General Service checks','Engine Oil Replacement','Oil Filter Inspection','Air Filter Cleaning','Chain Lubrication','Brake Inspection','Battery Voltage Check'],
        850, 'Engine-oil price may vary by vehicle and oil grade.', 150, '500 km / 1-month warranty'),
    ('BIKE_SERVICE', 'JUMP_START', ARRAY['Quick Help'],
        'Battery jump-start assistance for your bike.',
        'Technician checks the battery, starts the vehicle where possible and identifies basic charging issues.',
        ARRAY['Battery Voltage Check','Jump Start Attempt','Terminal Cleaning','Charging System Check'],
        199, 'Battery replacement or parts are charged separately.', 30, NULL),
    ('BIKE_SERVICE', 'RUNNING_REPAIR', ARRAY['Recommended'],
        'Diagnosis and repair for bike running issues.',
        'Initial inspection and diagnosis for engine, ignition, fuel or electrical running problems.',
        ARRAY['Engine Diagnosis','Spark Plug Check','Fuel Supply Check','Battery Voltage Check','Electrical Check-up','Test Ride'],
        299, 'Spare parts and additional repair work are charged after approval.', 60, NULL),
    ('BIKE_SERVICE', 'PUNCTURE', ARRAY['Quick Help'],
        'Bike tyre puncture repair.',
        'Puncture inspection, tyre repair and pressure check for one tyre.',
        ARRAY['Tyre Puncture Inspection','Puncture Repair','Tyre Pressure Check','Valve Check'],
        100, 'Rs 100 extra for each additional tyre puncture.', 30, NULL),
    ('CAR_SERVICE', 'GENERAL_SERVICE', ARRAY['Most Booked'],
        'Complete car health check and routine maintenance.',
        'A comprehensive car service covering key safety, fluid, electrical and engine checks.',
        ARRAY['Engine Oil Check','Air Filter Inspection','Battery Voltage Check','Brake Inspection','Coolant Level Check','Tyre Pressure Check','Electrical Check-up','Oil Leakage Check','Wiper Check','Interior Vacuuming'],
        999, NULL, 180, '1,000 km / 1-month warranty'),
    ('CAR_SERVICE', 'GENERAL_SERVICE_ENGINE_OIL', ARRAY['Best Value'],
        'General car service with engine oil replacement.',
        'Complete car service with engine oil replacement and a full multi-point inspection.',
        ARRAY['All General Service checks','Engine Oil Replacement','Oil Filter Replacement','Air Filter Inspection','Brake Inspection','Coolant Level Check','Tyre Pressure Check'],
        1899, 'Engine-oil price may vary by vehicle and oil grade.', 210, '1,000 km / 1-month warranty'),
    ('CAR_SERVICE', 'JUMP_START', ARRAY['Quick Help'],
        'Battery jump-start assistance for your car.',
        'Technician checks the battery and starts the vehicle where possible.',
        ARRAY['Battery Voltage Check','Jump Start Attempt','Battery Terminal Check','Alternator Check'],
        299, 'Battery replacement or parts are charged separately.', 30, NULL),
    ('CAR_SERVICE', 'RUNNING_REPAIR', ARRAY['Recommended'],
        'Diagnosis and repair for car running issues.',
        'Initial inspection and diagnosis for engine, fuel, ignition or electrical running problems.',
        ARRAY['Engine Diagnosis','OBD Scan','Battery Voltage Check','Fuel Supply Check','Electrical Check-up','Road Test'],
        499, 'Spare parts and additional repair work are charged after approval.', 90, NULL),
    ('CAR_SERVICE', 'PUNCTURE', ARRAY['Quick Help'],
        'Car tyre puncture repair.',
        'Puncture inspection, tyre repair and pressure check for one tyre.',
        ARRAY['Tyre Puncture Inspection','Puncture Repair','Tyre Pressure Check','Valve Check'],
        150, 'Rs 100 extra for each additional tyre puncture.', 30, NULL),
    ('RUNNING_REPAIR', 'RUNNING_REPAIR', ARRAY['Most Booked','Quick Help'],
        'Diagnosis and repair for running issues.',
        'A technician diagnoses bike or car running problems before any additional repair is started.',
        ARRAY['Initial Diagnosis','Battery Voltage Check','Fuel Supply Check','Electrical Check-up','Test Run'],
        299, 'Spare parts and additional repair work are charged after approval.', 60, NULL),
    ('PUNCTURE', 'PUNCTURE', ARRAY['Quick Help'],
        'Puncture repair for one tyre.',
        'Puncture inspection, tyre repair and tyre-pressure check for one tyre.',
        ARRAY['Tyre Puncture Inspection','Puncture Repair','Tyre Pressure Check','Valve Check'],
        100, 'Rs 100 extra for each additional tyre puncture.', 30, NULL)
)
UPDATE service_options option SET
    tags=details.tags, short_description=details.short_description,
    full_description=details.full_description, checklist=details.checklist,
    base_price=details.base_price, additional_charge_note=details.additional_charge_note,
    estimated_duration_minutes=details.duration, warranty_description=details.warranty,
    updated_at=CURRENT_TIMESTAMP
FROM details JOIN service_types service ON service.service_code=details.service_code
WHERE option.service_id=service.service_id AND option.service_option_code=details.option_code;
