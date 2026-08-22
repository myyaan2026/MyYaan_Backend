import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/db.js";

import userRoutes from "./routes/userRoutes.js";
import errorHandling from "./middlewares/errorHandler.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

//Middlewares
app.use(express.json());
app.use(cors());

//Routes
app.use("/api", userRoutes);
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

//Error Handling middlewares
app.use(errorHandling);

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

//Server Running
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
