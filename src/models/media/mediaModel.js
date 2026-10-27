import pool from "../../config/db.js";

/**
 * Inserts raw binary media file into media_files table.
 * Returns metadata without the heavy file_data payload.
 */
export const saveMediaFile = async ({
    userId = null,
    fileName = "image.jpg",
    mimeType = "image/jpeg",
    fileSize = 0,
    fileData,
}) => {
    const result = await pool.query(
        `INSERT INTO media_files
            (user_id, file_name, mime_type, file_size, file_data)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING media_id AS "mediaId",
                   uuid_token AS "uuidToken",
                   user_id AS "userId",
                   file_name AS "fileName",
                   mime_type AS "mimeType",
                   file_size AS "fileSize",
                   created_at AS "createdAt"`,
        [userId, fileName, mimeType, fileSize, fileData]
    );
    return result.rows[0];
};

/**
 * Retrieves full media record including binary buffer by numeric media_id.
 */
export const getMediaFileById = async (mediaId) => {
    const result = await pool.query(
        `SELECT media_id AS "mediaId",
                uuid_token AS "uuidToken",
                user_id AS "userId",
                file_name AS "fileName",
                mime_type AS "mimeType",
                file_size AS "fileSize",
                file_data AS "fileData",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
         FROM media_files
         WHERE media_id = $1`,
        [mediaId]
    );
    return result.rows[0] ?? null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Retrieves full media record by uuid_token.
 */
export const getMediaFileByUuid = async (uuidToken) => {
    if (!uuidToken || !UUID_REGEX.test(String(uuidToken).trim())) {
        return null;
    }
    const result = await pool.query(
        `SELECT media_id AS "mediaId",
                uuid_token AS "uuidToken",
                user_id AS "userId",
                file_name AS "fileName",
                mime_type AS "mimeType",
                file_size AS "fileSize",
                file_data AS "fileData",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
         FROM media_files
         WHERE uuid_token = $1`,
        [String(uuidToken).trim()]
    );
    return result.rows[0] ?? null;
};
