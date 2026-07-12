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

async function ensureIndex(db, table, indexName, columnsSql) {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = ? AND table_name = ? AND index_name = ?
     LIMIT 1`,
    [DATABASE, table, indexName],
  );
  if (rows.length > 0) {
    console.log(`[init-db] Index "${indexName}" on ${table} already exists.`);
    return;
  }
  await db.query(
    `ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${columnsSql})`,
  );
  console.log(`[init-db] Added index "${indexName}" on ${table}.`);
}

async function main() {
  try {
    console.log("[init-db] Connecting to MySQL server...");
    console.log(`[init-db] Using: ${USER}@${HOST}:${PORT}/${DATABASE}`);

    if (!USER || !DATABASE) {
      console.error(
        "[init-db] Error: MYSQL_USER and MYSQL_DATABASE must be set in .env.local"
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
      `CREATE DATABASE IF NOT EXISTS \`${DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
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
        INDEX idx_created_at (created_at),
        INDEX idx_event_type_created (event_type, created_at),
        INDEX idx_ip_created (ip_address, created_at),
        INDEX idx_host_path_ts (host(191), ts),
        INDEX idx_host (host(191)),
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
        INDEX idx_last_seen (last_seen),
        INDEX idx_full_url (full_url(191))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[init-db] Table "unique_users" is ready.');

    await db.query(`
     CREATE TABLE IF NOT EXISTS user_credentials (
      id_cr int NOT NULL AUTO_INCREMENT,
      pixel_id text COLLATE utf8mb4_unicode_ci,
      access_token text COLLATE utf8mb4_unicode_ci,
      test_code varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      site_url varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      PRIMARY KEY (id_cr)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('[init-db] Table "user_credentials" is ready.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS event_counts (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        site_key VARCHAR(255) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        day DATE NOT NULL,
        count BIGINT UNSIGNED NOT NULL DEFAULT 0,
        UNIQUE KEY uq_site_type_day (site_key, event_type, day),
        INDEX idx_day (day),
        INDEX idx_event_type_day (event_type, day),
        INDEX idx_site_day (site_key, day)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[init-db] Table "event_counts" is ready.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS referral_counts (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        site_key VARCHAR(255) NOT NULL,
        source VARCHAR(64) NOT NULL,
        event_type VARCHAR(50) NOT NULL DEFAULT 'PageView',
        day DATE NOT NULL,
        count BIGINT UNSIGNED NOT NULL DEFAULT 0,
        UNIQUE KEY uq_site_source_type_day (site_key, source, event_type, day),
        INDEX idx_day (day),
        INDEX idx_source_day (source, day),
        INDEX idx_site_day (site_key, day),
        INDEX idx_event_type (event_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[init-db] Table "referral_counts" is ready.');

    // If old referral_counts exists without event_type, recreate is handled by backfill script.
    // Ensure event_type column exists for upgraded DBs.
    try {
      const [cols] = await db.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'referral_counts' AND COLUMN_NAME = 'event_type'`,
        [DATABASE],
      );
      if (cols.length === 0) {
        console.log(
          "[init-db] referral_counts missing event_type — run: npm run backfill-referral-counts",
        );
      }
    } catch {
      // ignore
    }

    // Ensure indexes exist on already-created tables (CREATE TABLE IF NOT EXISTS skips new indexes)
    await ensureIndex(db, "events", "idx_created_at", "created_at");
    await ensureIndex(db, "events", "idx_event_type_created", "event_type, created_at");
    await ensureIndex(db, "events", "idx_ip_created", "ip_address, created_at");
    await ensureIndex(db, "events", "idx_host", "host(191)");
    await ensureIndex(db, "unique_users", "idx_full_url", "full_url(191)");

    await db.end();
    console.log("[init-db] Done.");
    process.exit(0);
  } catch (err) {
    console.error("[init-db] Error:", err);
    process.exit(1);
  }
}

main();
