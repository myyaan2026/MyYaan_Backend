import pkg from "pg";
import dotenv from "dotenv";
const { Pool } = pkg;
dotenv.config();

const host = process.env.DB_HOST;
// Supabase poolers require TLS. Local PostgreSQL stays unencrypted unless
// explicitly enabled with DB_SSL=true.
const useSsl = process.env.DB_SSL === "true" || host?.endsWith(".supabase.com");

const pool = new Pool ({
    user: process.env.DB_USER,
    host,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_DBPORT),
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10_000,
});

pool.on("connect", () => {
    console.log("Connection pool established with Database")
});

export default pool;
