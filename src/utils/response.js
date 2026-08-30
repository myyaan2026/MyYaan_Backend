export const sendResponse = (res, status, message, data = null) =>
    res.status(status).json({ status, message, data });

