import express from "express";
import {
    createMyAddress,
    getMyAddress,
    listMyAddresses,
    removeMyAddress,
    setMyPrimaryAddress,
    updateMyAddress,
} from "../../controller/profile/userAddressController.js";
import { authenticate } from "../../middlewares/auth.js";

const router = express.Router();
router.use(["/users/addresses", "/users/address"], authenticate);

router.get("/users/addresses", listMyAddresses);
router.get("/users/addresses/:addressId", getMyAddress);
router.get("/users/address", getMyAddress);

router.post("/users/addresses", createMyAddress);

router.put("/users/addresses/:addressId", updateMyAddress);
router.put("/users/addresses", updateMyAddress);
router.patch("/users/addresses/:addressId", updateMyAddress);
router.patch("/users/addresses/:addressId/primary", setMyPrimaryAddress);

router.delete("/users/addresses/:addressId", removeMyAddress);
router.delete("/users/addresses", removeMyAddress);
router.delete("/users/address", removeMyAddress);

export default router;

