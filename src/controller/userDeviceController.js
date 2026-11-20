import crypto from "node:crypto";
import { upsertUserDevice } from "../models/userDeviceModel.js";
import { sendResponse } from "../utils/response.js";
import { sendMulticastNotification } from "../services/notification/firebaseNotificationService.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION_PATTERN = /^\d+(?:\.\d+){0,3}(?:[-+][0-9A-Za-z.-]+)?$/;
const PUSH_PROVIDERS = new Set(["fcm", "apns", "other"]);

/**
 * Ensures any string (e.g. Android ID, iOS IDFV, hardware ID, or token)
 * is formatted into a valid UUID string suitable for PostgreSQL UUID columns.
 */
const toValidUuid = (val) => {
    if (!val) return null;
    const clean = String(val).trim();
    if (UUID_PATTERN.test(clean)) return clean.toLowerCase();
    // Deterministic UUID from non-UUID string
    const hash = crypto.createHash("sha256").update(clean).digest("hex");
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};

export const saveUserDevice = async (req, res, next) => {
    // Support user ID from authentication token, body, or header
    const rawUserId = req.auth?.userId ?? req.body?.userId ?? req.body?.user_id ?? req.headers["x-user-id"];
    const userId = rawUserId && !isNaN(Number(rawUserId)) ? Number(rawUserId) : null;
    const sessionId = req.auth?.sessionId ?? null;

    // Push / FCM Token: Accept fcmToken, fcm_token, pushToken, push_token, token, registrationToken
    const pushToken = String(
        req.body?.fcmToken ??
        req.body?.fcm_token ??
        req.body?.pushToken ??
        req.body?.push_token ??
        req.body?.token ??
        req.body?.registrationToken ??
        ""
    ).trim() || null;

    // Push Provider: Defaults to 'fcm' when a push token is provided
    let pushProvider = String(req.body?.pushProvider ?? req.body?.push_provider ?? "").trim().toLowerCase();
    if (pushToken && !pushProvider) {
        pushProvider = "fcm";
    }
    if (pushProvider && !PUSH_PROVIDERS.has(pushProvider)) {
        pushProvider = "fcm";
    }

    // Device Token / Installation ID
    const rawDeviceToken = String(
        req.body?.deviceToken ??
        req.body?.device_token ??
        req.body?.deviceId ??
        req.body?.device_id ??
        req.body?.installationId ??
        req.body?.installation_id ??
        ""
    ).trim();

    let deviceToken = toValidUuid(rawDeviceToken);
    if (!deviceToken) {
        if (pushToken) {
            // Deterministically map to same UUID per push token
            deviceToken = toValidUuid(pushToken);
        } else {
            deviceToken = crypto.randomUUID();
        }
    }

    // Device Type (android or ios)
    let deviceType = String(
        req.body?.deviceType ??
        req.body?.device_type ??
        req.body?.platform ??
        req.body?.os ??
        ""
    ).trim().toLowerCase();

    if (deviceType.includes("ios") || deviceType.includes("iphone") || deviceType.includes("ipad") || deviceType.includes("apple")) {
        deviceType = "ios";
    } else if (deviceType.includes("android")) {
        deviceType = "android";
    } else {
        const ua = String(req.headers["user-agent"] ?? "").toLowerCase();
        if (ua.includes("ios") || ua.includes("iphone") || ua.includes("cfnetwork") || ua.includes("darwin")) {
            deviceType = "ios";
        } else {
            deviceType = "android";
        }
    }

    // Device Name
    const deviceName = String(
        req.body?.deviceName ??
        req.body?.device_name ??
        req.body?.model ??
        ""
    ).trim() || null;

    // App Version
    let appVersion = String(
        req.body?.appVersion ??
        req.body?.app_version ??
        req.body?.version ??
        ""
    ).trim();
    if (!VERSION_PATTERN.test(appVersion)) {
        appVersion = "1.0.0";
    }

    // Build Number
    let rawBuildNumber = req.body?.buildNumber ?? req.body?.build_number ?? 1;
    let buildNumber = Number(rawBuildNumber);
    if (!Number.isSafeInteger(buildNumber) || buildNumber < 1) {
        buildNumber = 1;
    }

    // Notifications Enabled
    const notificationsEnabled =
        req.body?.notificationsEnabled !== false &&
        req.body?.notifications_enabled !== false;

    try {
        const device = await upsertUserDevice({
            userId,
            sessionId,
            deviceToken,
            deviceType,
            deviceName,
            appVersion,
            buildNumber,
            pushToken,
            pushProvider: pushToken ? pushProvider : null,
            notificationsEnabled,
        });

        return sendResponse(res, 200, "Device token updated successfully", device);
    } catch (error) {
        return next(error);
    }
};

/**
 * Utility endpoint to test dispatching a push notification directly to FCM tokens.
 */
export const testPushNotification = async (req, res, next) => {
    try {
        const singleToken = req.body?.fcmToken || req.body?.fcm_token || req.body?.pushToken || req.body?.push_token || req.body?.token;
        const tokens = Array.isArray(req.body?.tokens) ? req.body.tokens : (singleToken ? [singleToken] : []);
        const title = req.body?.title || "Test Push Notification 🚗";
        const body = req.body?.body || "Firebase push notification is working successfully on MyYaan!";
        const data = req.body?.data || { test: "true", timestamp: String(Date.now()) };

        if (!tokens.length) {
            return sendResponse(res, 400, "Please provide 'fcmToken', 'token', or 'tokens' array in request body");
        }

        const result = await sendMulticastNotification({
            tokens,
            title,
            body,
            data,
        });

        return sendResponse(res, 200, "Push notification dispatch result", result);
    } catch (error) {
        return next(error);
    }
};

