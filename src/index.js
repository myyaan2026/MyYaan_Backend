import express from "express";
import cors from "cors";
import pool from "./config/db.js";

import deviceRoutes from "./routes/deviceRoutes.js";
import systemRoutes from "./routes/systemRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import errorHandling from "./middlewares/errorHandler.js";

const app = express();
const port = process.env.PORT || 3001;

//Middlewares
app.use(express.json());
app.use(cors());

//Routes
app.use("/api", userRoutes);
app.use("/api", deviceRoutes);
app.use("/api", systemRoutes);
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
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
