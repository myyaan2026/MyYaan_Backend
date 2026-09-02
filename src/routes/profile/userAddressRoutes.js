import express from "express";
import {
    createMyAddress, getMyAddress, listMyAddresses, removeMyAddress, updateMyAddress,
} from "../../controller/profile/userAddressController.js";
import { authenticate } from "../../middlewares/auth.js";

const router = express.Router();
router.use(authenticate);
router.get("/users/addresses", listMyAddresses);
router.get("/users/address", getMyAddress);
router.post("/users/addresses", createMyAddress);
router.put("/users/addresses", updateMyAddress);
router.delete("/users/address", removeMyAddress);
export default router;

