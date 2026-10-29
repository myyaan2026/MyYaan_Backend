CREATE TABLE IF NOT EXISTS media_files (
    media_id BIGSERIAL PRIMARY KEY,
    uuid_token UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    file_name VARCHAR(255),
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    file_data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS media_files_user_id_idx ON media_files (user_id);
CREATE INDEX IF NOT EXISTS media_files_uuid_token_idx ON media_files (uuid_token);

ALTER TABLE media_files
    ADD COLUMN IF NOT EXISTS media_code VARCHAR(64) DEFAULT ('med_' || md5(random()::text || clock_timestamp()::text));

CREATE UNIQUE INDEX IF NOT EXISTS media_files_media_code_idx ON media_files (media_code);

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS profile_pic_id BIGINT REFERENCES media_files(media_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS profile_pic_media_code VARCHAR(64);

CREATE INDEX IF NOT EXISTS user_profiles_profile_pic_id_idx ON user_profiles (profile_pic_id);
CREATE INDEX IF NOT EXISTS user_profiles_profile_pic_media_code_idx ON user_profiles (profile_pic_media_code);


