import {
    createServiceCenter, getEnabledServices, getMyServiceCenter, getServicesForPartner,
    getSelectedServices, getServiceCenter, getServiceCenters, getServicePartnerOnboarding,
    getServiceCenterPricing, saveServiceCenterPricing,
    saveMyServiceCenter, saveMyServiceConfigurations, saveMyServiceOffers, saveServiceOffers, updateServiceCenter,
} from "../../models/service_partner/servicePartnerModel.js";
import { sendResponse } from "../../utils/response.js";

const cleanText = (value) => String(value ?? "").trim();
const optionalNumber = (value) => value === undefined || value === null || value === "" ? null : Number(value);
const positiveId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const parseCenter = (req, includeId) => ({
    userId: req.auth.userId,
    ...(includeId && { serviceCenterId: positiveId(req.body.serviceCenterId) }),
    serviceCenterName: cleanText(req.body.serviceCenterName),
    serviceCenterPicUrl: cleanText(req.body.serviceCenterPicUrl) || null,
    addressLine1: cleanText(req.body.addressLine1),
    addressLine2: cleanText(req.body.addressLine2) || null,
    city: cleanText(req.body.city), state: cleanText(req.body.state),
    pincode: cleanText(req.body.pincode), latitude: optionalNumber(req.body.latitude),
    longitude: optionalNumber(req.body.longitude),
});

const validateCenter = (res, details, includeId) => {
    if (includeId && !details.serviceCenterId) return sendResponse(res,400,"Service center ID must be a positive integer");
    if (!details.serviceCenterName || !details.addressLine1 || !details.city || !details.state) {
        return sendResponse(res,400,"Required service centre details must be provided");
    }
    if (!/^\d{6}$/.test(details.pincode)) return sendResponse(res,400,"Pincode must contain 6 digits");
    if ((details.latitude===null)!==(details.longitude===null)) return sendResponse(res,400,"Latitude and longitude must be provided together");
    if (details.latitude!==null && (!Number.isFinite(details.latitude)||details.latitude < -90||details.latitude > 90)) return sendResponse(res,400,"Latitude must be between -90 and 90");
    if (details.longitude!==null && (!Number.isFinite(details.longitude)||details.longitude < -180||details.longitude > 180)) return sendResponse(res,400,"Longitude must be between -180 and 180");
    return null;
};

export const listServices = async (req,res,next) => {
    try { return sendResponse(res,200,"Service list fetched successfully",await getEnabledServices()); }
    catch(error){ return next(error); }
};

export const getServiceById = async (req,res,next) => {
    const serviceId=positiveId(req.query.serviceId);
    if(!serviceId) return sendResponse(res,400,"Service ID query parameter is required");
    try {
        const service=await getEnabledServices(serviceId);
        if(!service) return sendResponse(res,404,"Service not found");
        return sendResponse(res,200,"Service fetched successfully",service);
    } catch(error){ return next(error); }
};

export const getOnboarding = async (req,res,next) => {
    try {
        const data=await getServicePartnerOnboarding(req.auth.userId);
        if(!data) return sendResponse(res,404,"Verified service partner not found");
        return sendResponse(res,200,"Onboarding details fetched successfully",data);
    } catch(error){ return next(error); }
};

export const listCenters = async (req,res,next) => {
    try { return sendResponse(res,200,"Service centres fetched successfully",await getServiceCenters(req.auth.userId)); }
    catch(error){ return next(error); }
};

export const getCenter = async (req,res,next) => {
    const serviceCenterId=positiveId(req.query.serviceCenterId);
    if(!serviceCenterId) return sendResponse(res,400,"Service center ID query parameter is required");
    try {
        const center=await getServiceCenter(req.auth.userId,serviceCenterId);
        if(!center) return sendResponse(res,404,"Service centre not found");
        return sendResponse(res,200,"Service centre fetched successfully",center);
    } catch(error){ return next(error); }
};

export const createCenter = async (req,res,next) => {
    const details=parseCenter(req,false); const invalid=validateCenter(res,details,false); if(invalid) return invalid;
    try {
        const result=await createServiceCenter(details);
        if(result.status==="partner_not_found") return sendResponse(res,404,"Verified service partner not found");
        return sendResponse(res,201,"Service centre created successfully",{serviceCenterId:result.serviceCenterId});
    } catch(error){ return next(error); }
};

export const updateCenter = async (req,res,next) => {
    const details=parseCenter(req,true); const invalid=validateCenter(res,details,true); if(invalid) return invalid;
    try {
        const result=await updateServiceCenter(details);
        if(result.status==="center_not_found") return sendResponse(res,404,"Service centre not found");
        return sendResponse(res,200,"Details are filled successfully");
    } catch(error){ return next(error); }
};

export const getMyServiceCenterAddress = async (req,res,next) => {
    try {
        const center=await getMyServiceCenter(req.auth.userId);
        if(!center) return sendResponse(res,404,"Service centre address not found");
        return sendResponse(res,200,"Service centre address fetched successfully",center);
    } catch(error){ return next(error); }
};

export const updateMyServiceCenterAddress = async (req,res,next) => {
    const details=parseCenter(req,false); const invalid=validateCenter(res,details,false); if(invalid) return invalid;
    try {
        const result=await saveMyServiceCenter(details);
        if(result.status==="partner_not_found") return sendResponse(res,404,"Verified service partner not found");
        return sendResponse(res,200,"Service centre address saved successfully",{serviceCenterId:result.serviceCenterId});
    } catch(error){ return next(error); }
};

export const getCenterServices = async (req,res,next) => {
    const serviceCenterId=positiveId(req.query.serviceCenterId);
    if(!serviceCenterId) return sendResponse(res,400,"Service center ID query parameter is required");
    try { return sendResponse(res,200,"Selected services fetched successfully",await getSelectedServices(req.auth.userId,serviceCenterId)); }
    catch(error){ return next(error); }
};

export const updateServiceOffers = async (req,res,next) => {
    const serviceCenterId=positiveId(req.body.serviceCenterId);
    const serviceIds=[...new Set(Array.isArray(req.body.serviceIds)?req.body.serviceIds.map(Number):[])];
    if(!serviceCenterId) return sendResponse(res,400,"Service center ID must be a positive integer");
    if(!serviceIds.length||serviceIds.some(id=>!Number.isSafeInteger(id)||id<1)) return sendResponse(res,400,"Select at least one valid service");
    try {
        const result=await saveServiceOffers({userId:req.auth.userId,serviceCenterId,serviceIds});
        if(result.status==="center_not_found") return sendResponse(res,404,"Service centre not found");
        if(result.status==="invalid_services") return sendResponse(res,400,"One or more selected services are invalid or disabled");
        return sendResponse(res,200,"Details are filled successfully");
    } catch(error){ return next(error); }
};

const parseServiceIds = (body) => [...new Set(Array.isArray(body.serviceIds)?body.serviceIds.map(Number):[])];

export const getMyServices = async (req,res,next) => {
    const serviceCenterId = req.query.serviceCenterId === undefined ? null : positiveId(req.query.serviceCenterId);
    if (req.query.serviceCenterId !== undefined && !serviceCenterId) {
        return sendResponse(res,400,"serviceCenterId must be a positive integer");
    }
    try {
        return sendResponse(
            res,
            200,
            "Service list fetched successfully",
            await getServicesForPartner(req.auth.userId, serviceCenterId),
        );
    } catch(error){ return next(error); }
};

export const updateMyServices = async (req,res,next) => {
    const serviceCenterId=positiveId(req.body.serviceCenterId);
    const services=Array.isArray(req.body.services) ? req.body.services.map((service) => ({
        serviceId: positiveId(service?.serviceId),
        subServiceIds: [...new Set(Array.isArray(service?.subServiceIds) ? service.subServiceIds.map(positiveId) : [])],
    })) : [];
    if(!serviceCenterId) return sendResponse(res,400,"serviceCenterId must be a positive integer");
    if(!services.length || services.some((service) => !service.serviceId || !service.subServiceIds.length || service.subServiceIds.some((subServiceId) => !subServiceId))) {
        return sendResponse(res,400,"Provide at least one service with its selected subServiceIds");
    }
    if(new Set(services.map((service) => service.serviceId)).size !== services.length) {
        return sendResponse(res,400,"Each serviceId must be included only once");
    }
    try {
        const result=await saveMyServiceConfigurations({userId:req.auth.userId,serviceCenterId,services});
        if(result.status==="center_not_found") return sendResponse(res,404,"Service centre details must be completed first");
        if(result.status==="partner_not_found") return sendResponse(res,404,"Verified service partner not found");
        if(result.status==="invalid_services") return sendResponse(res,400,"One or more selected services are invalid or disabled");
        if(result.status==="invalid_sub_services") return sendResponse(res,400,"One or more selected sub-services are invalid or disabled for its service");
        return sendResponse(res,200,"Services saved successfully");
    } catch(error){ return next(error); }
};

export const getCenterPricing = async (req, res, next) => {
    const serviceCenterId = positiveId(req.query.serviceCenterId);
    const serviceId = req.query.serviceId ? positiveId(req.query.serviceId) : null;
    if (!serviceCenterId) return sendResponse(res, 400, "serviceCenterId query parameter is required and must be a positive integer");
    try {
        const result = await getServiceCenterPricing(req.auth.userId, serviceCenterId, serviceId);
        if (result.status === "center_not_found") return sendResponse(res, 404, "Active service centre not found");
        return sendResponse(res, 200, "Service centre pricing fetched successfully", result.pricing);
    } catch (error) {
        return next(error);
    }
};

export const updateCenterPricing = async (req, res, next) => {
    const serviceCenterId = positiveId(req.body.serviceCenterId);
    const serviceId = positiveId(req.body.serviceId);
    const walkInPrice = optionalNumber(req.body.walkInPrice);
    const pickDropCharge = optionalNumber(req.body.pickDropCharge);
    const homeServicePrice = optionalNumber(req.body.homeServicePrice);
    const commissionAmount = optionalNumber(req.body.commissionAmount);

    if (!serviceCenterId || !serviceId) {
        return sendResponse(res, 400, "serviceCenterId and serviceId are required and must be positive integers");
    }
    if (walkInPrice !== null && (!Number.isFinite(walkInPrice) || walkInPrice < 0)) {
        return sendResponse(res, 400, "walkInPrice must be a non-negative number");
    }
    if (pickDropCharge !== null && (!Number.isFinite(pickDropCharge) || pickDropCharge < 0)) {
        return sendResponse(res, 400, "pickDropCharge must be a non-negative number");
    }
    if (homeServicePrice !== null && (!Number.isFinite(homeServicePrice) || homeServicePrice < 0)) {
        return sendResponse(res, 400, "homeServicePrice must be a non-negative number");
    }
    if (commissionAmount !== null && (!Number.isFinite(commissionAmount) || commissionAmount < 0)) {
        return sendResponse(res, 400, "commissionAmount must be a non-negative number");
    }

    try {
        const result = await saveServiceCenterPricing(req.auth.userId, {
            serviceCenterId,
            serviceId,
            walkInPrice: walkInPrice ?? 200,
            pickDropCharge: pickDropCharge ?? 200,
            homeServicePrice: homeServicePrice ?? 500,
            commissionAmount: commissionAmount ?? 50,
        });
        if (result.status === "center_not_found") return sendResponse(res, 404, "Active service centre not found");
        if (result.status === "service_not_found") return sendResponse(res, 404, "Selected service not found or disabled");
        return sendResponse(res, 200, "Service centre pricing saved successfully", result.pricing);
    } catch (error) {
        return next(error);
    }
};
