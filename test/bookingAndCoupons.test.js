import test from "node:test";
import assert from "node:assert/strict";
import {
    BASE_SLOTS,
    calculateDiscount,
    computeSlotsForDate,
    findMatchingSlot,
    getTodayDateIST,
    getCurrentMinutesIST,
    getUpcomingDatesIST,
    isSlotUpcoming,
} from "../src/models/user/service/booking/serviceBookingModel.js";
import {
    calculateServicePrice,
    normalizeSubServiceType,
} from "../src/models/user/service/discovery/servicePartnerDiscoveryModel.js";

test("time slots are at least 2 hours in duration", () => {
    assert.ok(BASE_SLOTS.length >= 4, "Should have multiple default time slots configured");

    for (const slot of BASE_SLOTS) {
        const [startH, startM] = slot.startTime.split(":").map(Number);
        const [endH, endM] = slot.endTime.split(":").map(Number);
        const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);

        assert.ok(
            durationMinutes >= 120,
            `Slot ${slot.slotId} duration (${durationMinutes} mins) must be at least 120 minutes (2 hours)`
        );
        assert.ok(slot.display.includes(" - "), `Slot ${slot.slotId} display should show start and end time`);
    }
});

test("findMatchingSlot resolves slot by slotId or display string case-insensitively", () => {
    const matchById = findMatchingSlot("09:00-11:00");
    assert.ok(matchById);
    assert.equal(matchById.startTime, "09:00:00");
    assert.equal(matchById.endTime, "11:00:00");

    const matchByDisplay = findMatchingSlot("09:00 AM - 11:00 AM");
    assert.ok(matchByDisplay);
    assert.equal(matchByDisplay.slotId, "09:00-11:00");

    const matchCaseInsensitive = findMatchingSlot("09:00 am - 11:00 am");
    assert.ok(matchCaseInsensitive);

    const invalidSlot = findMatchingSlot("01:00-02:00");
    assert.equal(invalidSlot, null);
});

test("computeSlotsForDate generates 2-hour slots for upcoming date", () => {
    const futureDate = "2099-01-01";
    const slots = computeSlotsForDate(futureDate);
    assert.equal(slots.length, BASE_SLOTS.length);
    assert.equal(slots[0].durationHours, 2);
    assert.equal(slots[0].slotId, "09:00-11:00");
});

test("computeSlotsForDate filters out past slots on today's date when time is 3:00 PM", () => {
    const today = getTodayDateIST();
    // Simulate current time as 3:00 PM (15:00 = 900 minutes)
    const simulatedCurrentMinutes = 15 * 60; // 3:00 PM IST
    const slots = computeSlotsForDate(today, new Map(), simulatedCurrentMinutes);

    // 09:00 AM, 11:00 AM, 01:00 PM, and 03:00 PM are already past or currently starting
    // Only 05:00 PM - 07:00 PM should be returned
    assert.equal(slots.length, 1);
    assert.equal(slots[0].slotId, "17:00-19:00");
    assert.equal(slots[0].display, "05:00 PM - 07:00 PM");
});

test("computeSlotsForDate filters out morning slots when time is 10:00 AM", () => {
    const today = getTodayDateIST();
    // Simulate current time as 10:00 AM (10 * 60 = 600 minutes)
    const simulatedCurrentMinutes = 10 * 60;
    const slots = computeSlotsForDate(today, new Map(), simulatedCurrentMinutes);

    // 09:00 AM slot is past/within 30 mins buffer
    // 11:00 AM, 01:00 PM, 03:00 PM, 05:00 PM should be available
    assert.equal(slots.length, 4);
    assert.equal(slots[0].slotId, "11:00-13:00");
    assert.equal(slots[1].slotId, "13:00-15:00");
    assert.equal(slots[2].slotId, "15:00-17:00");
    assert.equal(slots[3].slotId, "17:00-19:00");
});

test("computeSlotsForDate returns empty array for past dates", () => {
    const pastDate = "2020-01-01";
    const slots = computeSlotsForDate(pastDate);
    assert.equal(slots.length, 0);
});

test("isSlotUpcoming correctly identifies past vs future slots", () => {
    const today = getTodayDateIST();
    const simulated3PM = 15 * 60; // 3:00 PM

    // 11:00 AM and 01:00 PM are in the past when it's 3:00 PM
    assert.equal(isSlotUpcoming(today, "09:00:00", 30, simulated3PM), false);
    assert.equal(isSlotUpcoming(today, "11:00:00", 30, simulated3PM), false);
    assert.equal(isSlotUpcoming(today, "13:00:00", 30, simulated3PM), false);
    assert.equal(isSlotUpcoming(today, "15:00:00", 30, simulated3PM), false);

    // 05:00 PM is upcoming
    assert.equal(isSlotUpcoming(today, "17:00:00", 30, simulated3PM), true);

    // Any slot on future date is upcoming
    assert.equal(isSlotUpcoming("2099-01-01", "09:00:00"), true);

    // Any slot on past date is not upcoming
    assert.equal(isSlotUpcoming("2020-01-01", "17:00:00"), false);
});

test("normalizeSubServiceType identifies delivery mode correctly", () => {
    assert.equal(normalizeSubServiceType("WALK_IN", "Walk In Service"), "WALK_IN");
    assert.equal(normalizeSubServiceType("PICK_N_DROP", "Pick & Drop"), "PICK_N_DROP");
    assert.equal(normalizeSubServiceType("HOME_SERVICE", "Home Service"), "HOME_SERVICE");
    assert.equal(normalizeSubServiceType("DOORSTEP", "Doorstep Visit"), "HOME_SERVICE");
});

test("calculateServicePrice calculates WalkIn, PickNDrop, and HomeService with commission", () => {
    const customPricing = {
        walkInPrice: 200,
        pickDropCharge: 200,
        homeServicePrice: 500,
        commissionAmount: 50,
    };

    // 1. Walk-in: base 200, delivery 0, commission 50 -> 250
    const walkIn = calculateServicePrice({
        subServiceCode: "WALK_IN",
        subServiceName: "Walk In Service",
        customPricing,
        platformCommission: 50,
    });
    assert.equal(walkIn.basePrice, 200);
    assert.equal(walkIn.deliveryCharge, 0);
    assert.equal(walkIn.commissionAmount, 50);
    assert.equal(walkIn.priceBeforeCommission, 200);
    assert.equal(walkIn.finalPrice, 250);

    // 2. Pick & Drop: base 200 + pickDrop 200 + commission 50 -> 450 (400 + 50)
    const pickDrop = calculateServicePrice({
        subServiceCode: "PICK_N_DROP",
        subServiceName: "PickNDrop",
        customPricing,
        platformCommission: 50,
    });
    assert.equal(pickDrop.basePrice, 200);
    assert.equal(pickDrop.deliveryCharge, 200);
    assert.equal(pickDrop.commissionAmount, 50);
    assert.equal(pickDrop.priceBeforeCommission, 400);
    assert.equal(pickDrop.finalPrice, 450);

    // 3. Home Service: base 500 + commission 50 -> 550
    const homeService = calculateServicePrice({
        subServiceCode: "HOME_SERVICE",
        subServiceName: "Home Service",
        customPricing,
        platformCommission: 50,
    });
    assert.equal(homeService.basePrice, 500);
    assert.equal(homeService.deliveryCharge, 0);
    assert.equal(homeService.commissionAmount, 50);
    assert.equal(homeService.priceBeforeCommission, 500);
    assert.equal(homeService.finalPrice, 550);
});

test("calculateServicePrice falls back to catalog price when custom pricing is not set", () => {
    const result = calculateServicePrice({
        subServiceCode: "PICK_N_DROP",
        subServiceName: "PickNDrop",
        customPricing: null,
        catalogBasePrice: 350,
        platformCommission: 40,
    });
    assert.equal(result.basePrice, 350);
    assert.equal(result.deliveryCharge, 200);
    assert.equal(result.commissionAmount, 40);
    assert.equal(result.finalPrice, 350 + 200 + 40);
});

test("calculateDiscount applies FLAT discount correctly", () => {
    const result = calculateDiscount({
        discountType: "FLAT",
        discountValue: 100,
        minOrderAmount: 300,
        maxDiscountAmount: null,
        orderAmount: 500,
    });

    assert.equal(result.isValid, true);
    assert.equal(result.discountAmount, 100);
    assert.equal(result.finalAmount, 400);
});

test("calculateDiscount caps FLAT discount to order amount if discount exceeds order", () => {
    const result = calculateDiscount({
        discountType: "FLAT",
        discountValue: 200,
        minOrderAmount: 0,
        maxDiscountAmount: null,
        orderAmount: 150,
    });

    assert.equal(result.isValid, true);
    assert.equal(result.discountAmount, 150);
    assert.equal(result.finalAmount, 0);
});

test("calculateDiscount applies PERCENTAGE discount with max cap", () => {
    const resultCapped = calculateDiscount({
        discountType: "PERCENTAGE",
        discountValue: 20,
        minOrderAmount: 500,
        maxDiscountAmount: 150,
        orderAmount: 1000,
    });

    assert.equal(resultCapped.isValid, true);
    assert.equal(resultCapped.discountAmount, 150);
    assert.equal(resultCapped.finalAmount, 850);
});

test("calculateDiscount enforces minimum order amount", () => {
    const result = calculateDiscount({
        discountType: "FLAT",
        discountValue: 50,
        minOrderAmount: 399,
        maxDiscountAmount: null,
        orderAmount: 299,
    });

    assert.equal(result.isValid, false);
    assert.ok(result.message.includes("Minimum order amount"));
});
