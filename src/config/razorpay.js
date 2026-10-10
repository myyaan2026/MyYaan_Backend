import Razorpay from "razorpay";

let razorpayInstance = null;

export const getRazorpayClient = () => {
    if (razorpayInstance) return razorpayInstance;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        console.warn("[Razorpay] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured in .env");
        return null;
    }

    razorpayInstance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
    });

    return razorpayInstance;
};

export const isRazorpayConfigured = () => {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
};

