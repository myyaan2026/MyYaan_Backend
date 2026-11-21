import test from "node:test";
import assert from "node:assert/strict";
import { saveUserDevice, testPushNotification } from "../src/controller/userDeviceController.js";
import { initializeFirebase, sendMulticastNotification } from "../src/services/notification/firebaseNotificationService.js";

test("Firebase Admin SDK initializes successfully with configured credentials", () => {
    const isReady = initializeFirebase();
    assert.equal(isReady, true);
});

test("sendMulticastNotification returns empty response when tokens array is empty", async () => {
    const res = await sendMulticastNotification({
        tokens: [],
        title: "Test",
        body: "Body",
    });
    assert.equal(res.success, true);
    assert.equal(res.deliveredCount, 0);
    assert.equal(res.message, "No tokens provided");
});

test("testPushNotification returns 400 when no tokens provided", async () => {
    let responseStatus = null;
    let responseBody = null;

    const mockReq = { body: {} };
    const mockRes = {
        status(code) {
            responseStatus = code;
            return this;
        },
        json(payload) {
            responseBody = payload;
            return this;
        },
    };

    await testPushNotification(mockReq, mockRes);
    assert.equal(responseStatus, 400);
    assert.ok(responseBody.message.includes("tokens"));
});

test("saveUserDevice normalizes fcmToken, platform, and non-UUID hardware ID for guest device", async () => {
    let responseStatus = null;
    let responseBody = null;

    // Simulate mobile app payload with fcmToken and custom hardware deviceId
    const mockReq = {
        body: {
            fcmToken: "mock_fcm_token_device_guest_abc123",
            deviceId: "hardware_android_id_98765",
            platform: "Android",
            deviceName: "Pixel 8 Pro",
            appVersion: "1.0.0",
        },
        headers: {},
    };

    const mockRes = {
        status(code) {
            responseStatus = code;
            return this;
        },
        json(payload) {
            responseBody = payload;
            return this;
        },
    };

    await saveUserDevice(mockReq, mockRes, (err) => {
        if (err) throw err;
    });

    assert.equal(responseStatus, 200);
    assert.equal(responseBody.status, 200);
    assert.ok(responseBody.data);
    assert.equal(responseBody.data.deviceType, "android");
    assert.equal(responseBody.data.pushProvider, "fcm");
    assert.equal(responseBody.data.pushToken, "mock_fcm_token_device_guest_abc123");
    // Device token was converted to a deterministic valid UUID
    assert.match(
        responseBody.data.deviceToken,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
});

test("saveUserDevice links device to authenticated user", async () => {
    let responseStatus = null;
    let responseBody = null;

    const mockReq = {
        auth: { userId: 10, sessionId: null },
        body: {
            fcmToken: "mock_fcm_token_user_10",
            deviceId: "user_device_hw_10",
            deviceType: "ios",
            appVersion: "1.2.0",
        },
        headers: {},
    };

    const mockRes = {
        status(code) {
            responseStatus = code;
            return this;
        },
        json(payload) {
            responseBody = payload;
            return this;
        },
    };

    await saveUserDevice(mockReq, mockRes, (err) => {
        if (err) throw err;
    });

    assert.equal(responseStatus, 200);
    assert.equal(responseBody.status, 200);
    assert.equal(responseBody.data.userId, 10);
    assert.equal(responseBody.data.deviceType, "ios");
    assert.equal(responseBody.data.pushProvider, "fcm");
    assert.equal(responseBody.data.pushToken, "mock_fcm_token_user_10");
});

