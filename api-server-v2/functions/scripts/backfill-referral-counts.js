/**
 * One-time backfill of referral_counts from events.
 * Uses page host from full_url (not API host) so per-user site filters work.
 *
 * Usage: npm run backfill-referral-counts
 */

import mysql from "mysql2/promise";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { siteKeyFromEvent } from "../site-key.js";
import { classifyReferralSource } from "../referral-source.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "..", "..", ".env") });

const HOST = process.env.MYSQL_HOST || "127.0.0.1";
const PORT = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306;
const USER = process.env.MYSQL_USER || "root";
const PASSWORD = process.env.MYSQL_PASSWORD || "";
const DATABASE = process.env.MYSQL_DATABASE || "tracklikestap";
const BATCH = 5000;

const DDL = `
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
`;

async function main() {
  console.log("[backfill-referral-counts] Connecting...");
  const db = await mysql.createConnection({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DATABASE,
  });

  // Recreate with event_type column (fixes old schema + wrong site_key backfill)
  await db.query("DROP TABLE IF EXISTS referral_counts");
  await db.query(DDL);
  console.log("[backfill-referral-counts] Table ready. Scanning events...");

  const [[meta]] = await db.query(
    "SELECT MIN(id) AS minId, MAX(id) AS maxId, COUNT(*) AS total FROM events",
  );
  const minId = Number(meta.minId) || 0;
  const maxId = Number(meta.maxId) || 0;
  const total = Number(meta.total) || 0;
  console.log(`[backfill-referral-counts] ${total} events (id ${minId}..${maxId})`);

  if (total === 0) {
    await db.end();
    console.log("[backfill-referral-counts] Nothing to do.");
    process.exit(0);
  }

  const aggregates = new Map();
  let processed = 0;

  for (let start = minId; start <= maxId; start += BATCH) {
    const end = start + BATCH - 1;
    const [rows] = await db.query(
      `SELECT id, host, full_url, referrer, event_type, DATE(created_at) AS day
       FROM events
       WHERE id BETWEEN ? AND ?`,
      [start, end],
    );

    for (const row of rows) {
      const siteKey = siteKeyFromEvent({
        full_url: row.full_url,
        host: row.host,
      });
      const source = classifyReferralSource(row.referrer, row.full_url);
      const eventType = row.event_type || "PageView";
      const day =
        row.day instanceof Date
          ? row.day.toISOString().slice(0, 10)
          : String(row.day).slice(0, 10);
      const key = `${siteKey}\0${source}\0${eventType}\0${day}`;
      aggregates.set(key, (aggregates.get(key) || 0) + 1);
    }

    processed += rows.length;
    if (processed % 50000 < BATCH || end >= maxId) {
      console.log(`[backfill-referral-counts] Processed ~${processed}/${total}...`);
    }
  }

  console.log(`[backfill-referral-counts] Writing ${aggregates.size} summary rows...`);
  const entries = [...aggregates.entries()];
  const WRITE_BATCH = 150;
  for (let i = 0; i < entries.length; i += WRITE_BATCH) {
    const chunk = entries.slice(i, i + WRITE_BATCH);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const params = [];
    for (const [key, count] of chunk) {
      const [siteKey, source, eventType, day] = key.split("\0");
      params.push(siteKey, source, eventType, day, count);
    }
    await db.execute(
      `INSERT INTO referral_counts (site_key, source, event_type, day, count)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE count = VALUES(count)`,
      params,
    );
  }

  const [[check]] = await db.query("SELECT SUM(count) AS total FROM referral_counts");
  const [sites] = await db.query(
    "SELECT site_key, SUM(count) AS c FROM referral_counts GROUP BY site_key ORDER BY c DESC LIMIT 10",
  );
  console.log(
    `[backfill-referral-counts] Done. Summary total=${check.total}, events total=${total}`,
  );
  console.log("[backfill-referral-counts] Top sites:", sites);
  await db.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill-referral-counts] Error:", err);
  process.exit(1);
});
