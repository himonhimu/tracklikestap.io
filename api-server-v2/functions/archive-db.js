/**
 * Monthly archive databases.
 * Live: MYSQL_DATABASE (e.g. track_event_full)
 * Archive: {MYSQL_DATABASE}_YYYY_MM (e.g. track_event_full_2026_01)
 *
 * event_counts stay in live forever (Overview totals).
 * Only `events` (and optional unique_users snapshot) are archived/deleted.
 */

import mysql from "mysql2/promise";
import { getDb } from "./db.js";

const archivePools = new Map();

function envConfig() {
  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    liveDatabase: process.env.MYSQL_DATABASE || "tracklikestap",
  };
}

/** @param {string} yearMonth '2026-01' or '2026_01' */
export function normalizeYearMonth(yearMonth) {
  const s = String(yearMonth || "").trim().replace(/_/g, "-");
  if (!/^\d{4}-\d{2}$/.test(s)) return null;
  const [y, m] = s.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function archiveDbName(yearMonth) {
  const ym = normalizeYearMonth(yearMonth);
  if (!ym) return null;
  const { liveDatabase } = envConfig();
  return `${liveDatabase}_${ym.replace("-", "_")}`;
}

export function monthBounds(yearMonth) {
  const ym = normalizeYearMonth(yearMonth);
  if (!ym) return null;
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01 00:00:00`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${ym}-${String(lastDay).padStart(2, "0")} 23:59:59`;
  return { start, end, yearMonth: ym };
}

/** List YYYY-MM keys inclusive between two YYYY-MM-DD dates. */
export function monthsBetween(dateFrom, dateTo) {
  const from = String(dateFrom).trim().slice(0, 10);
  const to = String(dateTo).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return [];
  }
  if (from > to) return [];
  const out = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function serverConnection() {
  const { host, port, user, password } = envConfig();
  return mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  });
}

export async function databaseExists(dbName) {
  const conn = await serverConnection();
  try {
    const [rows] = await conn.query(
      `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ? LIMIT 1`,
      [dbName],
    );
    return rows.length > 0;
  } finally {
    await conn.end();
  }
}

export async function listArchiveMonths() {
  const { liveDatabase } = envConfig();
  const prefix = `${liveDatabase}_`;
  const conn = await serverConnection();
  try {
    const [rows] = await conn.query(
      `SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA
       WHERE SCHEMA_NAME LIKE ?
       ORDER BY SCHEMA_NAME DESC`,
      [prefix + "%"],
    );
    const months = [];
    for (const row of rows) {
      const name = row.name;
      if (name === liveDatabase) continue;
      const suffix = name.slice(prefix.length);
      if (/^\d{4}_\d{2}$/.test(suffix)) {
        months.push({
          yearMonth: suffix.replace("_", "-"),
          database: name,
        });
      }
    }
    return months;
  } finally {
    await conn.end();
  }
}

const EVENTS_DDL = `
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
`;

/**
 * Create archive database + events table (empty).
 */
export async function ensureArchiveDatabase(yearMonth) {
  const ym = normalizeYearMonth(yearMonth);
  const dbName = archiveDbName(ym);
  if (!dbName) throw new Error(`Invalid year-month: ${yearMonth}`);

  const conn = await serverConnection();
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await conn.changeUser({ database: dbName });
    await conn.query(EVENTS_DDL);
    return dbName;
  } finally {
    await conn.end();
  }
}

/**
 * Pool for a named database (cached).
 */
export function getPoolForDatabase(database) {
  if (!database) return null;
  const { liveDatabase, host, port, user, password } = envConfig();
  if (database === liveDatabase) return getDb();

  if (!archivePools.has(database)) {
    archivePools.set(
      database,
      mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 5,
      }),
    );
  }
  return archivePools.get(database);
}

/**
 * Resolve which DBs to query for a date window.
 * - Current / unarchived months → live
 * - Archived months → archive DB (if exists)
 * Dedupes live if multiple months still live.
 */
export async function resolveEventSources({
  dateFrom = null,
  dateTo = null,
  days = null,
} = {}) {
  const live = getDb();
  const { liveDatabase } = envConfig();
  const archives = await listArchiveMonths();
  const archivedSet = new Set(archives.map((a) => a.yearMonth));
  const archiveByMonth = new Map(archives.map((a) => [a.yearMonth, a.database]));

  let from;
  let to;
  if (
    dateFrom &&
    dateTo &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(dateFrom).trim()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(dateTo).trim())
  ) {
    from = String(dateFrom).trim().slice(0, 10);
    to = String(dateTo).trim().slice(0, 10);
  } else if (days != null && Number(days) > 0) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (Number(days) - 1));
    from = start.toISOString().slice(0, 10);
    to = end.toISOString().slice(0, 10);
  } else {
    // No range → live only (recent lists / defaults)
    return live
      ? [{ pool: live, database: liveDatabase, kind: "live", yearMonth: null }]
      : [];
  }

  const months = monthsBetween(from, to);
  const sources = [];
  let includeLive = false;

  for (const ym of months) {
    if (archivedSet.has(ym)) {
      const dbName = archiveByMonth.get(ym);
      const pool = getPoolForDatabase(dbName);
      if (pool) {
        sources.push({ pool, database: dbName, kind: "archive", yearMonth: ym });
      }
    } else {
      includeLive = true;
    }
  }

  if (includeLive && live) {
    sources.push({
      pool: live,
      database: liveDatabase,
      kind: "live",
      yearMonth: null,
    });
  }

  // If somehow empty (all months archived but DBs missing), fall back to live
  if (sources.length === 0 && live) {
    sources.push({
      pool: live,
      database: liveDatabase,
      kind: "live",
      yearMonth: null,
    });
  }

  return sources;
}

/**
 * Count events in a pool for a month window.
 */
export async function countEventsInRange(pool, start, end) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS c FROM events WHERE created_at >= ? AND created_at <= ?`,
    [start, end],
  );
  return Number(rows[0]?.c) || 0;
}

/**
 * Copy one month of events from live → archive (INSERT IGNORE by id).
 * Uses INSERT...SELECT across databases on same server.
 */
export async function copyMonthEventsToArchive(yearMonth) {
  const bounds = monthBounds(yearMonth);
  if (!bounds) throw new Error(`Invalid year-month: ${yearMonth}`);
  if (bounds.yearMonth === currentYearMonth()) {
    throw new Error("Refusing to archive the current month while it is still open");
  }

  const dbName = await ensureArchiveDatabase(bounds.yearMonth);
  const { liveDatabase } = envConfig();
  const live = getDb();
  if (!live) throw new Error("Live database pool not available");

  const liveCount = await countEventsInRange(live, bounds.start, bounds.end);
  console.log(
    `[archive] Live has ${liveCount} events for ${bounds.yearMonth} (${bounds.start} .. ${bounds.end})`,
  );

  if (liveCount === 0) {
    const archivePool = getPoolForDatabase(dbName);
    const archiveCount = await countEventsInRange(
      archivePool,
      bounds.start,
      bounds.end,
    );
    return {
      yearMonth: bounds.yearMonth,
      database: dbName,
      liveCount: 0,
      archiveCount,
      copied: 0,
      alreadyArchived: archiveCount > 0,
    };
  }

  // Cross-database copy on same MySQL server
  const conn = await serverConnection();
  try {
    await conn.query(
      `INSERT IGNORE INTO \`${dbName}\`.events
        (id, event_type, host, path, full_url, referrer, ua, ip_address, device_type, ts, product_data, value, currency, created_at)
       SELECT id, event_type, host, path, full_url, referrer, ua, ip_address, device_type, ts, product_data, value, currency, created_at
       FROM \`${liveDatabase}\`.events
       WHERE created_at >= ? AND created_at <= ?`,
      [bounds.start, bounds.end],
    );
  } finally {
    await conn.end();
  }

  const archivePool = getPoolForDatabase(dbName);
  const archiveCount = await countEventsInRange(
    archivePool,
    bounds.start,
    bounds.end,
  );

  return {
    yearMonth: bounds.yearMonth,
    database: dbName,
    liveCount,
    archiveCount,
    copied: archiveCount,
    verified: archiveCount >= liveCount,
  };
}

/**
 * Delete archived month from live after verify. Batched to avoid long locks.
 */
export async function deleteMonthFromLive(yearMonth, { batchSize = 5000 } = {}) {
  const bounds = monthBounds(yearMonth);
  if (!bounds) throw new Error(`Invalid year-month: ${yearMonth}`);
  if (bounds.yearMonth === currentYearMonth()) {
    throw new Error("Refusing to delete the current month from live");
  }

  const dbName = archiveDbName(bounds.yearMonth);
  const live = getDb();
  const archivePool = getPoolForDatabase(dbName);
  if (!live || !archivePool) throw new Error("DB pools unavailable");

  const liveCount = await countEventsInRange(live, bounds.start, bounds.end);
  const archiveCount = await countEventsInRange(
    archivePool,
    bounds.start,
    bounds.end,
  );

  if (liveCount === 0) {
    return { deleted: 0, liveCount: 0, archiveCount, skipped: true };
  }

  if (archiveCount < liveCount) {
    throw new Error(
      `Refuse delete: archive has ${archiveCount} rows but live has ${liveCount} for ${bounds.yearMonth}`,
    );
  }

  let deleted = 0;
  for (;;) {
    const [result] = await live.execute(
      `DELETE FROM events
       WHERE created_at >= ? AND created_at <= ?
       LIMIT ${Number(batchSize)}`,
      [bounds.start, bounds.end],
    );
    const n = result.affectedRows || 0;
    deleted += n;
    if (n === 0) break;
    console.log(`[archive] Deleted ${deleted} live events so far...`);
  }

  return { deleted, liveCount, archiveCount, skipped: false };
}
