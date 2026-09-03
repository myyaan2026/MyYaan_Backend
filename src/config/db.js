import pkg from "pg";
import dotenv from "dotenv";
const { Pool } = pkg;
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const host = process.env.DB_HOST;
const user = process.env.DB_USER;
const database = process.env.DB_DATABASE || process.env.DB_NAME;
const port = Number(process.env.DB_DBPORT || process.env.DB_PORT || 5432);
// Supabase poolers require TLS. Local PostgreSQL stays unencrypted unless
// explicitly enabled with DB_SSL=true.
const useSsl = process.env.DB_SSL === "true" || host?.endsWith(".supabase.com");

if (!connectionString && host?.endsWith(".pooler.supabase.com")) {
    if (user === host) {
        console.error(
            "Invalid database configuration: DB_USER contains the Supabase host. " +
            "Set DB_USER to the pooler user shown by Supabase (usually postgres.<project-ref>).",
        );
    } else if (!user?.startsWith("postgres.")) {
        console.error(
            "Invalid Supabase pooler user: DB_USER should usually be postgres.<project-ref>. " +
            "Copy the complete connection details from Supabase Dashboard > Connect.",
        );
    }
}

const pool = new Pool({
    ...(connectionString
        ? { connectionString }
        : {
            user,
            host,
            database,
            password: process.env.DB_PASSWORD,
            port,
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
