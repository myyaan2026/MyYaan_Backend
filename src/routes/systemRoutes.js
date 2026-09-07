import express from "express";
import { checkAppUpdate } from "../controller/systemController.js";

const router = express.Router();

router.get("/system/app-update", checkAppUpdate);

export default router;

