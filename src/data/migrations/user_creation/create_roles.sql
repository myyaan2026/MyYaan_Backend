CREATE TABLE IF NOT EXISTS roles (
    role_id INTEGER PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'role_id') THEN
        ALTER TABLE roles RENAME COLUMN id TO role_id;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS roles_role_id_key ON roles (role_id);

INSERT INTO roles (role_id, code, name) VALUES
    (1, 'user', 'User'),
    (2, 'service_partner', 'Service Partner'),
    (3, 'admin', 'Admin')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
