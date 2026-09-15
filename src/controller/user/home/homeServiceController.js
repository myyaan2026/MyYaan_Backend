import { getHomeServices } from "../../../models/user/home/homeServiceModel.js";
import { sendResponse } from "../../../utils/response.js";

export const listHomeServices = async (_req, res, next) => {
    try {
        return sendResponse(res, 200, "Home services fetched successfully", await getHomeServices());
    } catch (error) {
        return next(error);
    }
};
