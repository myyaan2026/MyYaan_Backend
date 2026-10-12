import {
    createUserAddress,
    deleteUserAddress,
    getUserAddress,
    getUserAddresses,
    setPrimaryUserAddress,
    updateUserAddress,
} from "../../models/profile/userAddressModel.js";
import { sendResponse } from "../../utils/response.js";

const cleanText = (value) => String(value ?? "").trim();
const optionalNumber = (value) => value === undefined || value === null || value === "" ? null : Number(value);
const parseAddressId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const ALLOWED_TAGS = ["HOME", "OFFICE", "WORK", "OTHER"];

const parseAddress = (req, includeId) => {
    const rawTag = cleanText(req.body.tag || req.body.addressLabel || "HOME").toUpperCase();
    const tag = ALLOWED_TAGS.includes(rawTag) ? rawTag : rawTag === "WORK" ? "OFFICE" : rawTag;
    const tagDetails = cleanText(req.body.tagDetails || req.body.otherTagDetails || req.body.otherTag || req.body.details) || null;

    const addressId = parseAddressId(req.params.addressId || req.body.addressId || req.query.addressId);

    return {
        userId: req.auth.userId,
        ...(includeId && { addressId }),
        tag,
        tagDetails,
        houseNumber: cleanText(req.body.houseNumber || req.body.flatNumber || req.body.houseNo),
        addressLine1: cleanText(req.body.addressLine1),
        addressLine2: cleanText(req.body.addressLine2) || null,
        landmark: cleanText(req.body.landmark) || null,
        city: cleanText(req.body.city),
        state: cleanText(req.body.state),
        pincode: cleanText(req.body.pincode),
        latitude: optionalNumber(req.body.latitude),
        longitude: optionalNumber(req.body.longitude),
        isPrimary: req.body.isPrimary === true || req.body.isDefault === true,
        isDefault: req.body.isPrimary === true || req.body.isDefault === true,
    };
};

const validateAddress = (res, details, isUpdate) => {
    if (isUpdate && !details.addressId) return sendResponse(res, 400, "Address ID must be a positive integer");

    if (!ALLOWED_TAGS.includes(details.tag)) {
        return sendResponse(res, 400, "Tag must be one of: HOME, OFFICE, WORK, OTHER");
    }

    if (details.tag === "OTHER" && !details.tagDetails && !isUpdate) {
        return sendResponse(res, 400, "Please provide tag details when tag is 'OTHER' (e.g. Parents' house, Shop)");
    }

    if (!isUpdate) {
        if (!details.houseNumber) {
            return sendResponse(res, 400, "House / Flat / Building number is required");
        }
        if (!details.addressLine1 || !details.city || !details.state) {
            return sendResponse(res, 400, "Address line 1, city and state are required");
        }
        if (!/^\d{6}$/.test(details.pincode)) {
            return sendResponse(res, 400, "Pincode must contain 6 digits");
        }
        if (details.latitude === null || details.longitude === null) {
            return sendResponse(res, 400, "Latitude and longitude are required for address");
        }
    } else {
        if (details.pincode && !/^\d{6}$/.test(details.pincode)) {
            return sendResponse(res, 400, "Pincode must contain 6 digits");
        }
        if ((details.latitude === null) !== (details.longitude === null)) {
            return sendResponse(res, 400, "Latitude and longitude must be provided together");
        }
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
        const addresses = await getUserAddresses(req.auth.userId);
        return sendResponse(res, 200, "Addresses fetched successfully", addresses);
    } catch (error) { return next(error); }
};

export const getMyAddress = async (req, res, next) => {
    const addressId = parseAddressId(req.params.addressId || req.query.addressId);
    if (!addressId) return sendResponse(res, 400, "Address ID is required and must be a positive integer");
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
        return sendResponse(res, 200, "Address updated successfully", address);
    } catch (error) { return next(error); }
};

export const setMyPrimaryAddress = async (req, res, next) => {
    const addressId = parseAddressId(req.params.addressId || req.body.addressId || req.query.addressId);
    if (!addressId) return sendResponse(res, 400, "Address ID is required and must be a positive integer");
    try {
        const address = await setPrimaryUserAddress(req.auth.userId, addressId);
        if (!address) return sendResponse(res, 404, "Address not found");
        return sendResponse(res, 200, "Primary address updated successfully", address);
    } catch (error) { return next(error); }
};

export const removeMyAddress = async (req, res, next) => {
    const addressId = parseAddressId(req.params.addressId || req.query.addressId || req.body.addressId);
    if (!addressId) return sendResponse(res, 400, "Address ID is required and must be a positive integer");
    try {
        if (!await deleteUserAddress(req.auth.userId, addressId)) return sendResponse(res, 404, "Address not found");
        return sendResponse(res, 200, "Address deleted successfully");
    } catch (error) { return next(error); }
};

