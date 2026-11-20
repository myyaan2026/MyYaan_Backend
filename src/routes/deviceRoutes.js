import express from "express";
import { saveUserDevice, testPushNotification } from "../controller/userDeviceController.js";
import { optionalAuthenticate } from "../middlewares/auth.js";

const router = express.Router();

// Device / FCM Token update endpoints (supports POST and PUT, authenticated or pre-auth)
router.post("/device/update", optionalAuthenticate, saveUserDevice);
router.put("/device/update", optionalAuthenticate, saveUserDevice);
router.post("/devices/update", optionalAuthenticate, saveUserDevice);
router.put("/devices/update", optionalAuthenticate, saveUserDevice);
router.post("/devices", optionalAuthenticate, saveUserDevice);
router.put("/devices", optionalAuthenticate, saveUserDevice);
router.post("/device", optionalAuthenticate, saveUserDevice);
router.put("/device", optionalAuthenticate, saveUserDevice);
router.post("/user/device/update", optionalAuthenticate, saveUserDevice);
router.put("/user/device/update", optionalAuthenticate, saveUserDevice);
router.post("/users/device/update", optionalAuthenticate, saveUserDevice);
router.put("/users/device/update", optionalAuthenticate, saveUserDevice);

// Test Push Notification endpoint for debugging/verifying FCM tokens
router.post("/device/test-push", optionalAuthenticate, testPushNotification);
router.post("/notifications/test-push", optionalAuthenticate, testPushNotification);

export default router;

