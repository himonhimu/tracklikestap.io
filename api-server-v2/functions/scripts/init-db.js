import mysql from "mysql2/promise";
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "..", "..", ".env") });

const HOST = process.env.MYSQL_HOST || "127.0.0.1";
const PORT = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306;
const USER = process.env.MYSQL_USER || "root";
const PASSWORD = process.env.MYSQL_PASSWORD || "";
const DATABASE = process.env.MYSQL_DATABASE || "tracklikestap";

async function main() {
  try {
    console.log("[init-db] Connecting to MySQL server...");
    console.log(`[init-db] Using: ${USER}@${HOST}:${PORT}/${DATABASE}`);

    if (!USER || !DATABASE) {
      console.error(
        "[init-db] Error: MYSQL_USER and MYSQL_DATABASE must be set in .env.local",
      );
      process.exit(1);
    }

    // First connect without selecting a database so we can create it
    const serverConnection = await mysql.createConnection({
      host: HOST,
      port: PORT,
      user: USER,
      password: PASSWORD,
      multipleStatements: true,
    });

    await serverConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    );
    console.log(`[init-db] Database "${DATABASE}" is ready.`);

    await serverConnection.end();

    // Now connect to the specific database
    const db = await mysql.createConnection({
      host: HOST,
      port: PORT,
      user: USER,
      password: PASSWORD,
      database: DATABASE,
      multipleStatements: true,
    });

    // Create events table
    await db.query(`
      CREATE TABLE IF NOT EXISTS events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL DEFAULT 'PageView',
        host VARCHAR(255),
        path TEXT,
        full_url TEXT,
        referrer TEXT,
        ua TEXT,
        ip_address VARCHAR(45),
        device_type VARCHAR(20),
        ts BIGINT,
        product_data JSON,
        value DECIMAL(10,2),
        currency VARCHAR(10),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_event_type (event_type),
        INDEX idx_ip_address (ip_address),
        INDEX idx_ts (ts),
        INDEX idx_host_path_ts (host(191), ts),
        INDEX idx_full_url (full_url(191))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('[init-db] Table "events" is ready.');

    // Create unique_users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS unique_users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        ip_address VARCHAR(45) NOT NULL,
        device_type VARCHAR(20) NOT NULL,
        full_url TEXT,
        user_agent TEXT,
        country VARCHAR(100),
        region VARCHAR(100),
        city VARCHAR(100),
        district VARCHAR(100),
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        first_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        visit_count INT UNSIGNED DEFAULT 1,
        UNIQUE KEY unique_ip_device (ip_address, device_type),
        INDEX idx_ip (ip_address),
        INDEX idx_device (device_type),
        INDEX idx_last_seen (last_seen)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('[init-db] Table "unique_users" is ready.');

    await db.end();
    console.log("[init-db] Done.");
    process.exit(0);
  } catch (err) {
    console.error("[init-db] Error:", err);
    process.exit(1);
  }
}

main();
