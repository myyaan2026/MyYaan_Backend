import fs from "node:fs";
import path from "node:path";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import pool from "../../config/db.js";

let firebaseInitialized = false;
let initAttempted = false;

/**
 * Initialize Firebase Admin SDK safely.
 * Supports:
 *  1. FIREBASE_SERVICE_ACCOUNT_PATH (file path)
 *  2. FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON string or base64)
 *  3. Individual env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *  4. Application Default Credentials (e.g. GOOGLE_APPLICATION_CREDENTIALS)
 */
export const initializeFirebase = () => {
    if (initAttempted) return firebaseInitialized;
    initAttempted = true;

    if (getApps().length > 0) {
        firebaseInitialized = true;
        return true;
    }

    try {
        const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        const jsonString = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;

        let credential = null;

        if (filePath) {
            const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
            if (fs.existsSync(resolvedPath)) {
                const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
                credential = cert(serviceAccount);
            } else {
                console.warn(`[Firebase] Service account file not found at: ${resolvedPath}`);
            }
        } else if (jsonString) {
            let parsed;
            try {
                parsed = JSON.parse(jsonString);
            } catch {
                // Try base64 decode if not plain JSON
                const decoded = Buffer.from(jsonString, "base64").toString("utf8");
                parsed = JSON.parse(decoded);
            }
            credential = cert(parsed);
        } else if (projectId && clientEmail && privateKey) {
            let formattedKey = String(privateKey).trim();
            if ((formattedKey.startsWith('"') && formattedKey.endsWith('"')) ||
                (formattedKey.startsWith("'") && formattedKey.endsWith("'"))) {
                formattedKey = formattedKey.slice(1, -1);
            }
            formattedKey = formattedKey.replace(/\\n/g, "\n");
            credential = cert({
                projectId: String(projectId).trim(),
                clientEmail: String(clientEmail).trim(),
                privateKey: formattedKey,
            });
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            credential = applicationDefault();
        }

        // Automatic fallback: check for firebase-service-account.json in project root
        if (!credential) {
            const defaultJsonPath = path.resolve(process.cwd(), "firebase-service-account.json");
            if (fs.existsSync(defaultJsonPath)) {
                try {
                    const serviceAccount = JSON.parse(fs.readFileSync(defaultJsonPath, "utf8"));
                    credential = cert(serviceAccount);
                } catch (e) {
                    console.warn("[Firebase] Could not parse ./firebase-service-account.json:", e.message);
                }
            }
        }

        if (credential) {
            initializeApp({ credential });
            firebaseInitialized = true;
            console.log("[Firebase] Firebase Admin SDK initialized successfully");
            return true;
        }

        console.info("[Firebase] Credentials not configured in .env. Push notifications are currently in simulated/mock mode.");
        return false;
    } catch (error) {
        console.error("[Firebase] Failed to initialize Firebase Admin SDK:", error.message);
        firebaseInitialized = false;
        return false;
    }
};

/**
 * Fetch all registered push tokens for a specific service partner (by service_center_id)
 */
export const getPartnerDeviceTokens = async (serviceCenterId) => {
    const result = await pool.query(
        `SELECT 
            sc.service_center_id AS "serviceCenterId",
            sc.service_center_name AS "serviceCenterName",
            sc.user_id AS "partnerUserId",
            d.device_id AS "deviceId",
            d.push_token AS "pushToken",
            d.device_type AS "deviceType"
         FROM service_centers sc
         JOIN user_device_details d ON d.user_id = sc.user_id
         WHERE sc.service_center_id = $1
           AND d.push_token IS NOT NULL
           AND d.notifications_enabled = TRUE
           AND d.is_active = TRUE`,
        [serviceCenterId]
    );
    return result.rows;
};

/**
 * Fetch all registered push tokens for a user (customer)
 */
export const getUserDeviceTokens = async (userId) => {
    const result = await pool.query(
        `SELECT 
            device_id AS "deviceId",
            push_token AS "pushToken",
            device_type AS "deviceType"
         FROM user_device_details
         WHERE user_id = $1
           AND push_token IS NOT NULL
           AND notifications_enabled = TRUE
           AND is_active = TRUE`,
        [userId]
    );
    return result.rows;
};

/**
 * Deactivate invalid or expired push tokens in the database
 */
const deactivateStaleTokens = async (tokens) => {
    if (!tokens || tokens.length === 0) return;
    try {
        await pool.query(
            `UPDATE user_device_details 
             SET is_active = FALSE, push_token = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE push_token = ANY($1::text[])`,
            [tokens]
        );
    } catch (err) {
        console.error("[Firebase] Error deactivating stale tokens:", err.message);
    }
};

/**
 * Send multicast notification to a list of FCM tokens
 */
export const sendMulticastNotification = async ({ tokens, title, body, data = {} }) => {
    if (!tokens || tokens.length === 0) {
        return { success: true, deliveredCount: 0, failedCount: 0, message: "No tokens provided" };
    }

    const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
    if (uniqueTokens.length === 0) {
        return { success: true, deliveredCount: 0, failedCount: 0, message: "No valid tokens provided" };
    }

    const isReady = initializeFirebase();
    if (!isReady) {
        console.info(`[Firebase Notification SIMULATED] Title: "${title}", Body: "${body}", Recipients: ${uniqueTokens.length} tokens`);
        return {
            success: true,
            simulated: true,
            deliveredCount: uniqueTokens.length,
            message: "Notification simulated (Firebase credentials not yet provided in .env)",
        };
    }

    // Convert all data values to strings (FCM requirement)
    const stringData = {};
    for (const [key, val] of Object.entries(data)) {
        stringData[key] = val == null ? "" : String(val);
    }

    const baseMessage = {
        notification: {
            title,
            body,
        },
        data: stringData,
        android: {
            priority: "high",
            notification: {
                channelId: data.channelId || "booking_updates",
                sound: "default",
                priority: "high",
                defaultSound: true,
                defaultVibrateTimings: true,
            },
        },
        apns: {
            headers: {
                "apns-priority": "10",
            },
            payload: {
                aps: {
                    alert: {
                        title,
                        body,
                    },
                    sound: "default",
                    badge: 1,
                    contentAvailable: true,
                },
            },
        },
    };

    try {
        const BATCH_SIZE = 500;
        let totalDelivered = 0;
        let totalFailed = 0;
        const staleTokens = [];

        for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
            const batchTokens = uniqueTokens.slice(i, i + BATCH_SIZE);
            const response = await getMessaging().sendEachForMulticast({
                ...baseMessage,
                tokens: batchTokens,
            });

            totalDelivered += response.successCount;
            totalFailed += response.failureCount;

            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errorCode = resp.error?.code;
                    if (
                        errorCode === "messaging/registration-token-not-registered" ||
                        errorCode === "messaging/invalid-registration-token"
                    ) {
                        staleTokens.push(batchTokens[idx]);
                    }
                }
            });
        }

        if (staleTokens.length > 0) {
            await deactivateStaleTokens(staleTokens);
        }

        return {
            success: true,
            deliveredCount: totalDelivered,
            failedCount: totalFailed,
            totalCount: uniqueTokens.length,
        };
    } catch (error) {
        console.error("[Firebase] Error sending multicast push notification:", error);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Notify the Service Partner when a customer completes a booking.
 */
export const sendBookingNotificationToPartner = async (bookingDetails) => {
    try {
        const {
            serviceCenterId,
            bookingId,
            bookingNumber,
            bookingDate,
            bookingTimeSlot,
            vehicle,
            service,
            pricing,
            paymentMode,
            paymentStatus,
        } = bookingDetails;

        if (!serviceCenterId) return;

        const partnerDevices = await getPartnerDeviceTokens(serviceCenterId);
        if (!partnerDevices.length) {
            console.info(`[Notification] No active device tokens found for Service Center #${serviceCenterId}`);
            return { success: true, deliveredCount: 0, message: "Partner has no active device registered" };
        }

        const vehicleDesc = [vehicle?.companyName, vehicle?.modelName, vehicle?.vehicleNumber]
            .filter(Boolean)
            .join(" ") || "Vehicle";
        const serviceDesc = service?.serviceName || service?.serviceOptionName || "Service";
        const finalAmt = pricing?.finalAmount != null ? `₹${pricing.finalAmount}` : "";

        const title = "New Service Booking Received! 🚗";
        const body = `Booking #${bookingNumber} for ${vehicleDesc} on ${bookingDate} (${bookingTimeSlot}). Amount: ${finalAmt}`;

        const dataPayload = {
            type: "NEW_BOOKING",
            bookingId: String(bookingId ?? ""),
            bookingNumber: String(bookingNumber ?? ""),
            bookingDate: String(bookingDate ?? ""),
            bookingTimeSlot: String(bookingTimeSlot ?? ""),
            serviceName: String(serviceDesc),
            finalAmount: String(pricing?.finalAmount ?? ""),
            paymentMode: String(paymentMode ?? ""),
            paymentStatus: String(paymentStatus ?? ""),
        };

        const tokens = partnerDevices.map((d) => d.pushToken);
        const result = await sendMulticastNotification({
            tokens,
            title,
            body,
            data: dataPayload,
        });

        console.log(`[Notification] Push notification sent to partner for booking #${bookingNumber}:`, result);
        return result;
    } catch (err) {
        console.error("[Notification] Error notifying service partner:", err);
        return { success: false, error: err.message };
    }
};

/**
 * Notify the customer (User) regarding booking status updates.
 */
export const sendBookingNotificationToCustomer = async ({ userId, bookingNumber, title, body, data = {} }) => {
    try {
        const userDevices = await getUserDeviceTokens(userId);
        if (!userDevices.length) return { success: true, deliveredCount: 0 };

        const tokens = userDevices.map((d) => d.pushToken);
        return await sendMulticastNotification({
            tokens,
            title: title || `Booking Update #${bookingNumber}`,
            body,
            data: {
                type: "BOOKING_UPDATE",
                bookingNumber: String(bookingNumber ?? ""),
                ...data,
            },
        });
    } catch (err) {
        console.error("[Notification] Error notifying customer:", err);
        return { success: false, error: err.message };
    }
};

/**
 * Send a custom push notification to all active devices of a user.
 */
export const sendNotificationToUser = async ({ userId, title, body, data = {} }) => {
    try {
        const userDevices = await getUserDeviceTokens(userId);
        if (!userDevices.length) {
            return { success: true, deliveredCount: 0, message: "No active devices found for user" };
        }
        const tokens = userDevices.map((d) => d.pushToken);
        return await sendMulticastNotification({
            tokens,
            title,
            body,
            data,
        });
    } catch (err) {
        console.error("[Notification] Error sending push notification to user:", err);
        return { success: false, error: err.message };
    }
};

/**
 * Send a custom push notification to all active devices of a service partner.
 */
export const sendNotificationToPartner = async ({ serviceCenterId, title, body, data = {} }) => {
    try {
        const partnerDevices = await getPartnerDeviceTokens(serviceCenterId);
        if (!partnerDevices.length) {
            return { success: true, deliveredCount: 0, message: "No active devices found for partner" };
        }
        const tokens = partnerDevices.map((d) => d.pushToken);
        return await sendMulticastNotification({
            tokens,
            title,
            body,
            data,
        });
    } catch (err) {
        console.error("[Notification] Error sending push notification to partner:", err);
        return { success: false, error: err.message };
    }
};


