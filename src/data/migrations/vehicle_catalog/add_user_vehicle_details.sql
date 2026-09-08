-- User-facing vehicle categories are stored on models.  A make can therefore
-- appear in both fuel and electric results when it sells both kinds of vehicle.
ALTER TABLE bike_models ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(20);
UPDATE bike_models AS model
SET vehicle_type = CASE
    WHEN company.company_short_name IN ('ATHER', 'OLA_ELECTRIC') THEN 'ELECTRIC_BIKE'
    ELSE 'BIKE'
END
FROM bike_companies AS company
WHERE company.bike_company_id = model.bike_company_id
  AND model.vehicle_type IS NULL;
ALTER TABLE bike_models ALTER COLUMN vehicle_type SET NOT NULL;
ALTER TABLE bike_models DROP CONSTRAINT IF EXISTS bike_models_vehicle_type_check;
ALTER TABLE bike_models ADD CONSTRAINT bike_models_vehicle_type_check
    CHECK (vehicle_type IN ('BIKE', 'ELECTRIC_BIKE'));

ALTER TABLE car_models ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(20);
UPDATE car_models
SET vehicle_type = CASE
    WHEN model_short_name IN ('COMET_EV', 'WINDSOR_EV', 'EC3', 'ATTO_3', 'SEAL', 'EMAX_7')
        THEN 'ELECTRIC_CAR'
    ELSE 'CAR'
END
WHERE vehicle_type IS NULL;
ALTER TABLE car_models ALTER COLUMN vehicle_type SET NOT NULL;
ALTER TABLE car_models DROP CONSTRAINT IF EXISTS car_models_vehicle_type_check;
ALTER TABLE car_models ADD CONSTRAINT car_models_vehicle_type_check
    CHECK (vehicle_type IN ('CAR', 'ELECTRIC_CAR'));

CREATE INDEX IF NOT EXISTS bike_models_vehicle_type_idx ON bike_models (vehicle_type, bike_company_id);
CREATE INDEX IF NOT EXISTS car_models_vehicle_type_idx ON car_models (vehicle_type, car_company_id);

-- One current vehicle selection per normal user. Updating the selection keeps
-- the OTP completion flag deterministic and avoids duplicate vehicle records.
CREATE TABLE IF NOT EXISTS user_vehicle_details (
    user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    vehicle_type VARCHAR(20) NOT NULL,
    bike_company_id INTEGER REFERENCES bike_companies(bike_company_id),
    bike_model_id INTEGER,
    car_company_id INTEGER REFERENCES car_companies(car_company_id),
    car_model_id INTEGER,
    vehicle_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_vehicle_details_type_check
        CHECK (vehicle_type IN ('BIKE', 'ELECTRIC_BIKE', 'CAR', 'ELECTRIC_CAR')),
    CONSTRAINT user_vehicle_details_number_check
        CHECK (vehicle_number ~ '^[A-Z0-9]{4,20}$'),
    CONSTRAINT user_vehicle_details_catalog_check CHECK (
        (vehicle_type IN ('BIKE', 'ELECTRIC_BIKE')
            AND bike_company_id IS NOT NULL AND bike_model_id IS NOT NULL
            AND car_company_id IS NULL AND car_model_id IS NULL)
        OR
        (vehicle_type IN ('CAR', 'ELECTRIC_CAR')
            AND car_company_id IS NOT NULL AND car_model_id IS NOT NULL
            AND bike_company_id IS NULL AND bike_model_id IS NULL)
    ),
    FOREIGN KEY (bike_model_id, bike_company_id)
        REFERENCES bike_models(bike_model_id, bike_company_id),
    FOREIGN KEY (car_model_id, car_company_id)
        REFERENCES car_models(car_model_id, car_company_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_vehicle_details_vehicle_number_key
    ON user_vehicle_details (vehicle_number);
