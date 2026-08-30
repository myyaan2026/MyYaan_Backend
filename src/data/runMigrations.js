import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "../config/db.js";

const migrationDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const migrations = [
    "create_roles.sql",
    "create_users.sql",
    "create_otp_codes.sql",
    "create_user_device_details.sql",
    "create_app_update_config.sql",
];

const run = async () => {
    const client = await pool.connect();
    try {
        await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
            migration_name TEXT PRIMARY KEY,
            executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`);

        const usersTable = await client.query("SELECT to_regclass(current_schema() || '.users') AS name");
        if (usersTable.rows[0].name) {
            const duplicateMobiles = await client.query(
                `SELECT mobile, COUNT(*)::int AS count
                 FROM users GROUP BY mobile HAVING COUNT(*) > 1`
            );
            if (duplicateMobiles.rowCount) {
                const mobiles = duplicateMobiles.rows.map((row) => row.mobile).join(", ");
                throw new Error(`Resolve duplicate users.mobile values before migrating: ${mobiles}`);
            }
        }

        for (const migrationName of migrations) {
            const completed = await client.query(
                "SELECT 1 FROM schema_migrations WHERE migration_name = $1",
                [migrationName]
            );
            if (completed.rowCount) {
                console.log(`Skipped ${migrationName}`);
                continue;
            }

            const sql = await fs.readFile(path.join(migrationDirectory, migrationName), "utf8");
            await client.query("BEGIN");
            try {
                await client.query(sql);
                await client.query(
                    "INSERT INTO schema_migrations (migration_name) VALUES ($1)",
                    [migrationName]
                );
                await client.query("COMMIT");
                console.log(`Applied ${migrationName}`);
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            }
        }
    } finally {
        client.release();
        await pool.end();
    }
};

run().catch((error) => {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
});
