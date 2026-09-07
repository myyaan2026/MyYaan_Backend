import { getAppUpdateConfig } from "../models/systemModel.js";
import { sendResponse } from "../utils/response.js";

const VERSION_PATTERN = /^\d+(?:\.\d+){0,3}(?:[-+][0-9A-Za-z.-]+)?$/;
export const compareVersions = (left, right) => {
    const normalize = (version) => version.split(/[-+]/, 1)[0].split(".").map(Number);
    const leftParts = normalize(left);
    const rightParts = normalize(right);
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
        const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
        if (difference !== 0) return Math.sign(difference);
    }
    return 0;
};

export const checkAppUpdate = async (req, res, next) => {
    const deviceType = String(req.query.deviceType ?? "").trim().toLowerCase();
    const appVersion = String(req.query.appVersion ?? "").trim();
    const buildNumber = req.query.buildNumber == null ? null : Number(req.query.buildNumber);

    if (!["android", "ios"].includes(deviceType)) {
        return sendResponse(res, 400, "Device type must be android or ios");
    }
    if (!VERSION_PATTERN.test(appVersion)) {
        return sendResponse(res, 400, "App version must be a valid version such as 1.0.0");
    }
    if (buildNumber !== null && (!Number.isSafeInteger(buildNumber) || buildNumber < 1)) {
        return sendResponse(res, 400, "Build number must be a positive integer");
    }

    try {
        const config = await getAppUpdateConfig(deviceType);
        if (!config) return sendResponse(res, 404, "App update configuration not found");

        const belowMinimumVersion = compareVersions(appVersion, config.minimumSupportedVersion) < 0;
        const belowMinimumBuild = buildNumber !== null && config.minimumSupportedBuild !== null
            && buildNumber < config.minimumSupportedBuild;
        const forceUpdate = config.forceUpdateEnabled && (belowMinimumVersion || belowMinimumBuild);
        const updateAvailable = compareVersions(appVersion, config.latestVersion) < 0
            || (buildNumber !== null && config.latestBuild !== null && buildNumber < config.latestBuild);

        return sendResponse(res, 200, "App update status fetched successfully", {
            deviceType,
            currentVersion: appVersion,
            currentBuild: buildNumber,
            latestVersion: config.latestVersion,
            latestBuild: config.latestBuild,
            minimumSupportedVersion: config.minimumSupportedVersion,
            minimumSupportedBuild: config.minimumSupportedBuild,
            updateAvailable,
            forceUpdate,
            storeUrl: config.storeUrl,
            message: updateAvailable ? config.updateMessage : null,
        });
    } catch (error) {
        return next(error);
    }
};
