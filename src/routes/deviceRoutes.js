import express from "express";
import { saveUserDevice } from "../controller/userDeviceController.js";

const router = express.Router();

router.put("/devices", saveUserDevice);
router.put("/devicesInfo", saveUserDevice);

export default router;
