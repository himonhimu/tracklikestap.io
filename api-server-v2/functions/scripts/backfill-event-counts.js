/**
 * One-time backfill of event_counts from existing events rows.
 * Safe to re-run: replaces counts via ON DUPLICATE KEY UPDATE.
 *
 * Usage: npm run backfill-event-counts
 */

import mysql from "mysql2/promise";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { normalizeSiteKey } from "../site-key.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "..", "..", ".env") });

const HOST = process.env.MYSQL_HOST || "127.0.0.1";
const PORT = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306;
const USER = process.env.MYSQL_USER || "root";
const PASSWORD = process.env.MYSQL_PASSWORD || "";
const DATABASE = process.env.MYSQL_DATABASE || "tracklikestap";

const BATCH = 5000;

async function main() {
  console.log("[backfill-event-counts] Connecting...");
  const db = await mysql.createConnection({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DATABASE,
  });

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

  // Clear then rebuild so counts match events exactly
  await db.query("TRUNCATE TABLE event_counts");
  console.log("[backfill-event-counts] Cleared event_counts. Scanning events...");

  const [[meta]] = await db.query("SELECT MIN(id) AS minId, MAX(id) AS maxId, COUNT(*) AS total FROM events");
  const minId = Number(meta.minId) || 0;
  const maxId = Number(meta.maxId) || 0;
  const total = Number(meta.total) || 0;
  console.log(`[backfill-event-counts] ${total} events (id ${minId}..${maxId})`);

  if (total === 0) {
    await db.end();
    console.log("[backfill-event-counts] Nothing to do.");
    process.exit(0);
  }

  const aggregates = new Map(); // key -> count
  let processed = 0;

  for (let start = minId; start <= maxId; start += BATCH) {
    const end = start + BATCH - 1;
    const [rows] = await db.query(
      `SELECT id, event_type, host, full_url, DATE(created_at) AS day
       FROM events
       WHERE id BETWEEN ? AND ?`,
      [start, end],
    );

    for (const row of rows) {
      let siteKey = null;
      if (row.full_url) {
        try {
          siteKey = normalizeSiteKey(new URL(row.full_url).hostname);
        } catch {
          siteKey = normalizeSiteKey(row.full_url);
        }
      }
      if (!siteKey) siteKey = normalizeSiteKey(row.host);
      siteKey = siteKey || "unknown";
      const eventType = row.event_type || "PageView";
      const day =
        row.day instanceof Date
          ? row.day.toISOString().slice(0, 10)
          : String(row.day).slice(0, 10);
      const key = `${siteKey}\0${eventType}\0${day}`;
      aggregates.set(key, (aggregates.get(key) || 0) + 1);
    }

    processed += rows.length;
    if (processed % 50000 < BATCH || end >= maxId) {
      console.log(`[backfill-event-counts] Processed ~${processed}/${total}...`);
    }
  }

  console.log(`[backfill-event-counts] Writing ${aggregates.size} summary rows...`);
  const entries = [...aggregates.entries()];
  const WRITE_BATCH = 200;
  for (let i = 0; i < entries.length; i += WRITE_BATCH) {
    const chunk = entries.slice(i, i + WRITE_BATCH);
    const placeholders = chunk.map(() => "(?, ?, ?, ?)").join(", ");
    const params = [];
    for (const [key, count] of chunk) {
      const [siteKey, eventType, day] = key.split("\0");
      params.push(siteKey, eventType, day, count);
    }
    await db.execute(
      `INSERT INTO event_counts (site_key, event_type, day, count)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE count = VALUES(count)`,
      params,
    );
  }

  const [[check]] = await db.query(
    "SELECT SUM(count) AS total FROM event_counts",
  );
  console.log(
    `[backfill-event-counts] Done. Summary total=${check.total}, events total=${total}`,
  );
  await db.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill-event-counts] Error:", err);
  process.exit(1);
});
