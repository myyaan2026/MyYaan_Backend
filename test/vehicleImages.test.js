import test from "node:test";
import assert from "node:assert/strict";
import pool from "../src/config/db.js";
import {
    getVehicleCompanies,
    getVehicleModels,
    getUserVehicles,
    getUserVehicleById,
} from "../src/models/vehicle/userVehicleModel.js";

test.after(async () => {
    await pool.end();
});

test("getVehicleCompanies returns company logo URL and media ID for bike and car", async () => {
    const bikeCompanies = await getVehicleCompanies("BIKE");
    assert.ok(bikeCompanies.length > 0, "Should have bike companies");
    const firstBike = bikeCompanies[0];
    assert.ok(firstBike.companyId, "Must have companyId");
    assert.ok(firstBike.companyName, "Must have companyName");
    assert.ok(firstBike.logoId || firstBike.companyLogoId, "Must have company logo ID");
    assert.ok(firstBike.logoUrl || firstBike.companyLogoUrl, "Must have company logo URL");
    assert.match(firstBike.logoUrl, /^\/api\/media\//, "logoUrl must point to /api/media/");

    const carCompanies = await getVehicleCompanies("CAR");
    assert.ok(carCompanies.length > 0, "Should have car companies");
    const firstCar = carCompanies[0];
    assert.ok(firstCar.logoId || firstCar.companyLogoId, "Must have company logo ID");
    assert.ok(firstCar.logoUrl || firstCar.companyLogoUrl, "Must have company logo URL");
    assert.match(firstCar.logoUrl, /^\/api\/media\//, "logoUrl must point to /api/media/");
});

test("getVehicleModels returns model image and company logo IDs and URLs", async () => {
    const bikeModels = await getVehicleModels("BIKE");
    assert.ok(bikeModels.length > 0, "Should have bike models");
    const firstBikeModel = bikeModels[0];
    assert.ok(firstBikeModel.modelId, "Must have modelId");
    assert.ok(firstBikeModel.modelName, "Must have modelName");
    assert.ok(firstBikeModel.imageId || firstBikeModel.modelImageId, "Must have model image ID");
    assert.ok(firstBikeModel.imageUrl || firstBikeModel.modelImageUrl, "Must have model image URL");
    assert.ok(firstBikeModel.companyLogoId || firstBikeModel.logoId, "Must have company logo ID");
    assert.ok(firstBikeModel.companyLogoUrl || firstBikeModel.logoUrl, "Must have company logo URL");
    assert.match(firstBikeModel.imageUrl, /^\/api\/media\//, "imageUrl must point to /api/media/");
    assert.match(firstBikeModel.companyLogoUrl, /^\/api\/media\//, "companyLogoUrl must point to /api/media/");

    const carModels = await getVehicleModels("CAR");
    assert.ok(carModels.length > 0, "Should have car models");
    const firstCarModel = carModels[0];
    assert.ok(firstCarModel.imageId || firstCarModel.modelImageId, "Must have model image ID");
    assert.ok(firstCarModel.imageUrl || firstCarModel.modelImageUrl, "Must have model image URL");
    assert.ok(firstCarModel.companyLogoId || firstCarModel.logoId, "Must have company logo ID");
    assert.ok(firstCarModel.companyLogoUrl || firstCarModel.logoUrl, "Must have company logo URL");
    assert.match(firstCarModel.imageUrl, /^\/api\/media\//, "imageUrl must point to /api/media/");
    assert.match(firstCarModel.companyLogoUrl, /^\/api\/media\//, "companyLogoUrl must point to /api/media/");
});
