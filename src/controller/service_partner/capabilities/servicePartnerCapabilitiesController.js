import { getPartnerSubServices, getPartnerVehicleSupport, savePartnerSubServices, savePartnerVehicleSupport } from "../../../models/service_partner/capabilities/servicePartnerCapabilitiesModel.js";
import { sendResponse } from "../../../utils/response.js";

const id = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const types = new Set(["BIKE", "ELECTRIC_BIKE", "CAR", "ELECTRIC_CAR"]);
const vehicleType = (value) => String(value ?? "").trim().toUpperCase().replace(/[ -]+/g, "_");
const ids = (value) => [...new Set(Array.isArray(value) ? value.map(id) : [])];
const invalidIds = (values) => !values.length || values.some((value) => !value);

export const getMySubServiceCapabilities = async (req, res, next) => {
    const serviceCenterId=id(req.query.serviceCenterId), serviceId=id(req.query.serviceId);
    if (!serviceCenterId || !serviceId) return sendResponse(res,400,"serviceCenterId and serviceId are required");
    try { return sendResponse(res,200,"Sub-service capabilities fetched successfully",await getPartnerSubServices(req.auth.userId,serviceCenterId,serviceId)); } catch(error){ return next(error); }
};
export const updateMySubServiceCapabilities = async (req,res,next) => {
    const serviceCenterId=id(req.body.serviceCenterId), serviceId=id(req.body.serviceId), subServiceIds=ids(req.body.subServiceIds);
    if (!serviceCenterId||!serviceId||invalidIds(subServiceIds)) return sendResponse(res,400,"Provide serviceCenterId, serviceId and at least one subServiceId");
    try { const result=await savePartnerSubServices({userId:req.auth.userId,serviceCenterId,serviceId,subServiceIds});
        if(result==="center_or_service_not_found") return sendResponse(res,404,"Service centre or offered service not found");
        if(result==="invalid_sub_services") return sendResponse(res,400,"One or more sub-services are invalid or disabled");
        return sendResponse(res,200,"Sub-service capabilities saved successfully"); } catch(error){return next(error);}
};
export const getMyVehicleCapabilities = async (req,res,next) => {
    const serviceCenterId=id(req.query.serviceCenterId), serviceId=id(req.query.serviceId), type=vehicleType(req.query.vehicleType);
    if(!serviceCenterId||!serviceId||!types.has(type)) return sendResponse(res,400,"Provide serviceCenterId, serviceId and a valid vehicleType");
    try{return sendResponse(res,200,"Vehicle capabilities fetched successfully",await getPartnerVehicleSupport(req.auth.userId,serviceCenterId,serviceId,type));}catch(error){return next(error);}
};
export const updateMyVehicleCapabilities = async (req,res,next) => {
    const serviceCenterId=id(req.body.serviceCenterId),serviceId=id(req.body.serviceId),type=vehicleType(req.body.vehicleType),modelIds=ids(req.body.modelIds);
    if(!serviceCenterId||!serviceId||!types.has(type)||invalidIds(modelIds)) return sendResponse(res,400,"Provide serviceCenterId, serviceId, valid vehicleType and at least one modelId");
    try {const result=await savePartnerVehicleSupport({userId:req.auth.userId,serviceCenterId,serviceId,vehicleType:type,modelIds});
        if(result==="center_or_service_not_found") return sendResponse(res,404,"Service centre or offered service not found");
        if(result==="invalid_models") return sendResponse(res,400,"One or more models are invalid, disabled or do not match vehicleType");
        return sendResponse(res,200,"Vehicle capabilities saved successfully");}catch(error){return next(error);}
};
