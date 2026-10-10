import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/db.js";

import deviceRoutes from "./routes/deviceRoutes.js";
import systemRoutes from "./routes/systemRoutes.js";
import servicePartnerRoutes from "./routes/service_partner/servicePartnerRoutes.js";
import userProfileRoutes from "./routes/profile/userProfileRoutes.js";
import userAddressRoutes from "./routes/profile/userAddressRoutes.js";
import servicePartnerProfileRoutes from "./routes/profile/service_partner_profile/servicePartnerProfileRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import userVehicleRoutes from "./routes/vehicle/userVehicleRoutes.js";
import homeServiceRoutes from "./routes/user/home/homeServiceRoutes.js";
import serviceBookingRoutes from "./routes/user/service/booking/serviceBookingRoutes.js";
import servicePartnerDiscoveryRoutes from "./routes/user/service/discovery/servicePartnerDiscoveryRoutes.js";
import paymentRoutes from "./routes/payment/paymentRoutes.js";
import errorHandling from "./middlewares/errorHandler.js";

dotenv.config();

const app = express();
//const port = process.env.PORT || 3001;

//Middlewares
app.use(express.json({
    verify: (req, _res, buf) => {
        req.rawBody = buf.toString();
    }
}));
app.use(cors());

//Routes
app.use("/api", userRoutes);
app.use("/api", userVehicleRoutes);
app.use("/api", homeServiceRoutes);
app.use("/api", serviceBookingRoutes);
app.use("/api", servicePartnerDiscoveryRoutes);
app.use("/api", paymentRoutes);
app.use("/api", deviceRoutes);
app.use("/api", systemRoutes);
app.use("/api", servicePartnerRoutes);
app.use("/api", userProfileRoutes);
app.use("/api", userAddressRoutes);
app.use("/api", servicePartnerProfileRoutes);
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

//Testing Postgres Connection 
app.get("/", async(req, res) => {
    try {
        const result = await pool.query("SELECT current_database()");
        res.send(`The database name is: ${result.rows[0].current_database}`);
    } catch (error) {
        console.error("Database connection failed:", error.message);
        res.status(500).json({ error: "Unable to connect to the database" });
    }
});

// Error handling must be registered after every route.
app.use(errorHandling);

//Server Running
export default app;
// app.listen(port, () => {
//     console.log(`Server is running on http://localhost:${port}`);
// });
