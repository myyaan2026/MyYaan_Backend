import express from "express";
import { saveUserDevice } from "../controller/userDeviceController.js";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

router.put("/devices", authenticate, saveUserDevice);

export default router;
