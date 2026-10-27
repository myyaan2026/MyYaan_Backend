import crypto from "node:crypto";

const MEDIA_PREFIX = "med_";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getEncryptionKey = () => {
    const rawSecret =
        process.env.MEDIA_ENCRYPTION_KEY ||
        process.env.JWT_SECRET ||
        "myyaan-default-media-crypto-secret-key-32b";
    return crypto.createHash("sha256").update(rawSecret).digest();
};

/**
 * Encrypts a mediaId (and optional uuidToken) into a tamper-proof URL-safe string.
 * Format: med_<base64url(iv[12] + authTag[16] + ciphertext)>
 */
export const encryptMediaId = (mediaId, uuidToken = null) => {
    if (!mediaId && mediaId !== 0) return null;
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    const payload = JSON.stringify({
        id: Number(mediaId),
        uuid: uuidToken ? String(uuidToken) : null,
        t: Date.now(),
    });

    const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const packed = Buffer.concat([iv, authTag, encrypted]);
    return `${MEDIA_PREFIX}${packed.toString("base64url")}`;
};

/**
 * Decrypts a media token and returns { mediaId, uuidToken } or null if invalid.
 */
export const decryptMediaToken = (token) => {
    if (!token || typeof token !== "string") return null;
    const trimmed = token.trim();

    // Check if directly a UUID
    if (UUID_REGEX.test(trimmed)) {
        return { mediaId: null, uuidToken: trimmed };
    }

    let encoded = trimmed;
    if (encoded.startsWith(MEDIA_PREFIX)) {
        encoded = encoded.slice(MEDIA_PREFIX.length);
    }

    try {
        const packed = Buffer.from(encoded, "base64url");
        if (packed.length < 28) {
            return null;
        }

        const iv = packed.subarray(0, 12);
        const authTag = packed.subarray(12, 28);
        const ciphertext = packed.subarray(28);

        const key = getEncryptionKey();
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]).toString("utf8");

        const data = JSON.parse(decrypted);
        if (data && typeof data.id === "number" && !isNaN(data.id)) {
            return {
                mediaId: data.id,
                uuidToken: data.uuid || null,
            };
        }
        return null;
    } catch {
        return null;
    }
};

/**
 * Convenience helper returning just the numeric mediaId or null.
 */
export const decryptMediaId = (token) => {
    const res = decryptMediaToken(token);
    return res?.mediaId ?? null;
};

