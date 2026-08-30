import test from "node:test";
import assert from "node:assert/strict";
import { compareVersions } from "../src/controller/systemController.js";

test("compareVersions compares numeric version segments", () => {
    assert.equal(compareVersions("1.2.0", "1.1.9"), 1);
    assert.equal(compareVersions("1.0", "1.0.0"), 0);
    assert.equal(compareVersions("1.0.0", "2.0.0"), -1);
});

test("compareVersions ignores prerelease and build suffixes", () => {
    assert.equal(compareVersions("1.2.3+45", "1.2.3"), 0);
    assert.equal(compareVersions("1.2.3-beta", "1.2.4"), -1);
});

