import test from "node:test";
import assert from "node:assert/strict";
import {
    encryptMediaId,
    decryptMediaToken,
    decryptMediaId,
} from "../src/utils/mediaCrypto.js";

test("encryptMediaId returns a tamper-proof med_ prefixed token", () => {
    const token = encryptMediaId(42, "3f98c8c2-4966-4f91-b3b0-b5d137df75eb");
    assert.ok(typeof token === "string");
    assert.ok(token.startsWith("med_"));

    const decrypted = decryptMediaToken(token);
    assert.equal(decrypted.mediaId, 42);
    assert.equal(decrypted.uuidToken, "3f98c8c2-4966-4f91-b3b0-b5d137df75eb");

    const idOnly = decryptMediaId(token);
    assert.equal(idOnly, 42);
});

test("encryptMediaId generates distinct random ciphertexts for the same ID", () => {
    const token1 = encryptMediaId(100, "uuid-1");
    const token2 = encryptMediaId(100, "uuid-1");
    assert.notEqual(token1, token2, "Unique IVs should produce different tokens");

    assert.equal(decryptMediaId(token1), 100);
    assert.equal(decryptMediaId(token2), 100);
});

test("decryptMediaToken rejects tampered or forged tokens", () => {
    const token = encryptMediaId(99, "some-uuid");
    // Tamper with the token characters
    const tampered = token.slice(0, -4) + "XXXX";
    const decrypted = decryptMediaToken(tampered);
    assert.equal(decrypted, null);
    assert.equal(decryptMediaId(tampered), null);
});

test("decryptMediaToken safely rejects invalid non-token strings", () => {
    assert.equal(decryptMediaToken(null), null);
    assert.equal(decryptMediaToken(""), null);
    assert.equal(decryptMediaToken("random_string_123"), null);
    assert.equal(decryptMediaToken("med_short"), null);
});

test("decryptMediaToken recognizes raw UUID as fallback", () => {
    const rawUuid = "e7498c0d-13bb-4d43-9d0d-2b7e923e8e19";
    const res = decryptMediaToken(rawUuid);
    assert.equal(res.mediaId, null);
    assert.equal(res.uuidToken, rawUuid);
});

