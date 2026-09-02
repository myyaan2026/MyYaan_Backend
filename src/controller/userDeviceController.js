import { upsertUserDevice } from "../models/userDeviceModel.js";
import { sendResponse } from "../utils/response.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION_PATTERN = /^\d+(?:\.\d+){0,3}(?:[-+][0-9A-Za-z.-]+)?$/;
const DEVICE_TYPES = new Set(["android", "ios"]);
const PUSH_PROVIDERS = new Set(["fcm", "apns", "other"]);

export const saveUserDevice = async (req, res, next) => {
    const userId = req.auth.userId;
    const deviceToken = String(req.body.deviceToken ?? "").trim().toLowerCase();
    const deviceType = String(req.body.deviceType ?? "").trim().toLowerCase();
    const deviceName = String(req.body.deviceName ?? "").trim() || null;
    const appVersion = String(req.body.appVersion ?? "").trim();
    const buildNumber = req.body.buildNumber == null ? null : Number(req.body.buildNumber);
    const pushToken = String(req.body.pushToken ?? "").trim() || null;
    const pushProvider = String(req.body.pushProvider ?? "").trim().toLowerCase() || null;
    const notificationsEnabled = req.body.notificationsEnabled !== false;
    if (!UUID_PATTERN.test(deviceToken)) {
        return sendResponse(res, 400, "Device token must be a valid installation UUID");
    }
    if (!DEVICE_TYPES.has(deviceType)) {
        return sendResponse(res, 400, "Device type must be android or ios");
    }
    if (!VERSION_PATTERN.test(appVersion)) {
        return sendResponse(res, 400, "App version must be a valid version such as 1.0.0");
    }
    if (buildNumber !== null && (!Number.isSafeInteger(buildNumber) || buildNumber < 1)) {
        return sendResponse(res, 400, "Build number must be a positive integer");
    }
    if ((pushToken && !pushProvider) || (!pushToken && pushProvider)) {
        return sendResponse(res, 400, "Push token and push provider must be provided together");
    }
    if (pushProvider && !PUSH_PROVIDERS.has(pushProvider)) {
        return sendResponse(res, 400, "Push provider must be fcm, apns, or other");
    }

    try {
        const device = await upsertUserDevice({
            userId,
            deviceToken,
            deviceType,
            deviceName,
            appVersion,
            buildNumber,
            pushToken,
            pushProvider,
            notificationsEnabled,
        });
        return sendResponse(res, 200, "User device information saved successfully", device);
    } catch (error) {
        return next(error);
    }
};
