import pkg from "pg";
import dotenv from "dotenv";
const { Pool } = pkg;
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const host = process.env.DB_HOST;
// Supabase poolers require TLS. Local PostgreSQL stays unencrypted unless
// explicitly enabled with DB_SSL=true.
const useSsl = process.env.DB_SSL === "true" || host?.endsWith(".supabase.com");

const pool = new Pool({
    ...(connectionString
        ? { connectionString }
        : {
            user: process.env.DB_USER,
            host,
            database: process.env.DB_DATABASE,
            password: process.env.DB_PASSWORD,
            port: Number(process.env.DB_DBPORT),
        }),
    // Explicitly configure SSL here rather than in DATABASE_URL. This avoids
    // pg's sslmode URL parsing overriding these TLS options.
    ssl: connectionString || useSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10_000,
});

pool.on("connect", () => {
    console.log("Connection pool established with Database")
});

export default pool;
