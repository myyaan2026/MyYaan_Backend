import test from "node:test";
import assert from "node:assert/strict";
import { MASTER_OTP, generateRandomOtp } from "../src/controller/userController.js";

test("MASTER_OTP default is 101010", () => {
    assert.equal(MASTER_OTP, "101010");
});

test("generateRandomOtp returns a 6-digit string and never equals MASTER_OTP", () => {
    for (let i = 0; i < 100; i++) {
        const otp = generateRandomOtp();
        assert.equal(otp.length, 6);
        assert.match(otp, /^\d{6}$/);
        assert.notEqual(otp, MASTER_OTP);
    }
});
