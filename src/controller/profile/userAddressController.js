import {
    createUserAddress,
    deleteUserAddress,
    getUserAddress,
    getUserAddresses,
    updateUserAddress,
} from "../../models/profile/userAddressModel.js";
import { sendResponse } from "../../utils/response.js";

const cleanText = (value) => String(value ?? "").trim();
const optionalNumber = (value) => value === undefined || value === null || value === "" ? null : Number(value);
const parseAddressId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const parseAddress = (req, includeId) => ({
    userId: req.auth.userId,
    ...(includeId && { addressId: parseAddressId(req.body.addressId) }),
    addressLabel: cleanText(req.body.addressLabel) || null,
    addressLine1: cleanText(req.body.addressLine1),
    addressLine2: cleanText(req.body.addressLine2) || null,
    city: cleanText(req.body.city),
    state: cleanText(req.body.state),
    pincode: cleanText(req.body.pincode),
    latitude: optionalNumber(req.body.latitude),
    longitude: optionalNumber(req.body.longitude),
    isDefault: req.body.isDefault === true,
});

const validateAddress = (res, details, includeId) => {
    if (includeId && !details.addressId) return sendResponse(res, 400, "Address ID must be a positive integer");
    if (!details.addressLine1 || !details.city || !details.state) {
        return sendResponse(res, 400, "Address line 1, city and state are required");
    }
    if (!/^\d{6}$/.test(details.pincode)) return sendResponse(res, 400, "Pincode must contain 6 digits");
    if ((details.latitude === null) !== (details.longitude === null)) {
        return sendResponse(res, 400, "Latitude and longitude must be provided together");
    }
    if (details.latitude !== null && (!Number.isFinite(details.latitude) || details.latitude < -90 || details.latitude > 90)) {
        return sendResponse(res, 400, "Latitude must be between -90 and 90");
    }
    if (details.longitude !== null && (!Number.isFinite(details.longitude) || details.longitude < -180 || details.longitude > 180)) {
        return sendResponse(res, 400, "Longitude must be between -180 and 180");
    }
    return null;
};

export const listMyAddresses = async (req, res, next) => {
    try {
        return sendResponse(res, 200, "Addresses fetched successfully", await getUserAddresses(req.auth.userId));
    } catch (error) { return next(error); }
};

export const getMyAddress = async (req, res, next) => {
    const addressId = parseAddressId(req.query.addressId);
    if (!addressId) return sendResponse(res, 400, "Address ID query parameter is required");
    try {
        const address = await getUserAddress(req.auth.userId, addressId);
        if (!address) return sendResponse(res, 404, "Address not found");
        return sendResponse(res, 200, "Address fetched successfully", address);
    } catch (error) { return next(error); }
};

export const createMyAddress = async (req, res, next) => {
    const details = parseAddress(req, false);
    const errorResponse = validateAddress(res, details, false);
    if (errorResponse) return errorResponse;
    try {
        const address = await createUserAddress(details);
        return sendResponse(res, 201, "Address created successfully", address);
    } catch (error) { return next(error); }
};

export const updateMyAddress = async (req, res, next) => {
    const details = parseAddress(req, true);
    const errorResponse = validateAddress(res, details, true);
    if (errorResponse) return errorResponse;
    try {
        const address = await updateUserAddress(details);
        if (!address) return sendResponse(res, 404, "Address not found");
        return sendResponse(res, 200, "Address updated successfully");
    } catch (error) { return next(error); }
};

export const removeMyAddress = async (req, res, next) => {
    const addressId = parseAddressId(req.query.addressId);
    if (!addressId) return sendResponse(res, 400, "Address ID query parameter is required");
    try {
        if (!await deleteUserAddress(req.auth.userId, addressId)) return sendResponse(res, 404, "Address not found");
        return sendResponse(res, 200, "Address deleted successfully");
    } catch (error) { return next(error); }
};

