/**
 * Analytics read queries for the dashboard API.
 */

import { getDb } from "./db.js";
import { getEventCountsFromSummary } from "./event-counts.js";
import { normalizeSiteKey } from "./site-key.js";
import { resolveEventSources, listArchiveMonths } from "./archive-db.js";
import { classifyReferralSource } from "./referral-source.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 300;
const DEFAULT_IP_EVENTS_LIMIT = 200;
const MAX_IP_EVENTS_LIMIT = 500;
const DEFAULT_AGG_DAYS = 30;
const MAX_STATS_IPS = 100;

/**
 * Clamp a positive integer limit for list queries.
 */
export function clampLimit(limit, fallback = DEFAULT_LIST_LIMIT, max = MAX_LIST_LIMIT) {
  const n = parseInt(limit, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/**
 * Normalize site_url / url_contains to a bare host-like string.
 * e.g. "https://www.example.com/path" -> "example.com"
 */
export function normalizeSiteFilter(urlContains) {
  return normalizeSiteKey(urlContains);
}

/**
 * Prefer host equality so indexes on `host` can be used.
 * Falls back to substring match on full_url/path for older rows.
 */
function appendEventsSiteFilter(sql, params, urlContains) {
  const site = normalizeSiteFilter(urlContains);
  if (!site) return sql;
  const like = "%" + site + "%";
  sql +=
    " AND (host = ? OR host = ? OR host LIKE ? OR full_url LIKE ? OR path LIKE ?)";
  params.push(site, "www." + site, "%." + site, like, like);
  return sql;
}

/**
 * unique_users has no host column — filter full_url only.
 */
function appendUniqueUsersSiteFilter(sql, params, urlContains, alreadyHasWhere = false) {
  const site = normalizeSiteFilter(urlContains);
  if (!site) return sql;
  const like = "%" + site + "%";
  sql += alreadyHasWhere ? " AND full_url LIKE ?" : " WHERE full_url LIKE ?";
  params.push(like);
  return sql;
}

/**
 * Optional created_at window. days <= 0 means no time filter.
 */
function appendCreatedAtWindow(sql, params, days, column = "created_at") {
  if (days == null) days = DEFAULT_AGG_DAYS;
  const n = parseInt(days, 10);
  if (!Number.isFinite(n) || n <= 0) return sql;
  sql += ` AND ${column} >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? DAY)`;
  params.push(n);
  return sql;
}

function parseDaysParam(days, defaultDays = DEFAULT_AGG_DAYS) {
  if (days === "all" || days === "0" || days === 0) return 0;
  if (days == null || days === "") return defaultDays;
  const n = parseInt(days, 10);
  if (!Number.isFinite(n)) return defaultDays;
  return n;
}

/**
 * Get total unique users count
 * @param {string|null} urlContains
 * @param {number|string|null} days - lookback days (default 30; 0 = all time)
 */
export async function getTotalUniqueUsers(urlContains = null, days = DEFAULT_AGG_DAYS) {
  const db = getDb();
  if (!db) return null;

  try {
    let sql = "SELECT COUNT(*) as count FROM unique_users WHERE 1=1";
    const params = [];
    sql = appendUniqueUsersSiteFilter(sql, params, urlContains, true);
    const lookBack = parseDaysParam(days);
    if (lookBack > 0) {
      sql += " AND last_seen >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? DAY)";
      params.push(lookBack);
    }
    const [rows] = await db.execute(sql, params);
    return rows[0].count;
  } catch (err) {
    console.error("[analytics] Failed to get unique users:", err);
    return null;
  }
}

/**
 * Get unique users by device type
 */
export async function getUniqueUsersByDevice(urlContains = null, days = DEFAULT_AGG_DAYS) {
  const db = getDb();
  if (!db) return null;

  try {
    let sql = `SELECT device_type, COUNT(*) as count 
       FROM unique_users WHERE 1=1`;
    const params = [];
    sql = appendUniqueUsersSiteFilter(sql, params, urlContains, true);
    const lookBack = parseDaysParam(days);
    if (lookBack > 0) {
      sql += " AND last_seen >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? DAY)";
      params.push(lookBack);
    }
    sql += " GROUP BY device_type";
    const [rows] = await db.execute(sql, params);
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get users by device:", err);
    return null;
  }
}

/**
 * Get unique users by location
 */
export async function getUniqueUsersByLocation(urlContains = null, days = DEFAULT_AGG_DAYS) {
  const db = getDb();
  if (!db) return null;

  try {
    let sql = `SELECT country, region, city, district, COUNT(*) as count 
       FROM unique_users 
       WHERE country IS NOT NULL`;
    const params = [];
    sql = appendUniqueUsersSiteFilter(sql, params, urlContains, true);
    const lookBack = parseDaysParam(days);
    if (lookBack > 0) {
      sql += " AND last_seen >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? DAY)";
      params.push(lookBack);
    }
    sql +=
      " GROUP BY country, region, city, district ORDER BY count DESC LIMIT 100";
    const [rows] = await db.execute(sql, params);
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get users by location:", err);
    return null;
  }
}

/**
 * Get event counts by type (from precomputed event_counts; falls back to events scan).
 */
export async function getEventCounts(urlContains = null, days = DEFAULT_AGG_DAYS) {
  const lookBack = parseDaysParam(days);
  const fromSummary = await getEventCountsFromSummary(urlContains, lookBack);
  if (fromSummary != null) {
    return fromSummary;
  }

  // Fallback only when summary table is missing / query failed
  const db = getDb();
  if (!db) return null;

  try {
    let sql = `SELECT event_type, COUNT(*) as count 
       FROM events WHERE 1=1`;
    const params = [];
    sql = appendEventsSiteFilter(sql, params, urlContains);
    sql = appendCreatedAtWindow(sql, params, lookBack);
    sql += " GROUP BY event_type";
    const [rows] = await db.execute(sql, params);
    const data = rows.map((r) => ({
      event_type: r.event_type,
      count: Number(r.count) || 0,
    }));
    const totalCount = data.reduce((acc, row) => acc + row.count, 0);
    return { data, totalCount };
  } catch (err) {
    console.error("[analytics] Failed to get event counts:", err);
    return null;
  }
}

/**
 * Get purchase events with details
 */
export async function getPurchaseEvents(limit = DEFAULT_LIST_LIMIT, urlContains = null) {
  return getEventsByType("Purchase", limit, urlContains);
}

/**
 * Get add to cart events
 */
export async function getAddToCartEvents(limit = DEFAULT_LIST_LIMIT, urlContains = null) {
  return getEventsByType("AddToCart", limit, urlContains);
}

/**
 * Get recent events for any event type.
 * Optional dateFrom/dateTo (YYYY-MM-DD) routes to live + monthly archive DBs.
 * Optional referralSource filters by classified source (Google, Facebook, …).
 */
export async function getEventsByType(
  eventType,
  limit = DEFAULT_LIST_LIMIT,
  urlContains = null,
  dateFrom = null,
  dateTo = null,
  referralSource = null,
) {
  if (!eventType || typeof eventType !== "string") return null;

  const safeLimit = clampLimit(limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  const wantReferral =
    referralSource && String(referralSource).trim() && String(referralSource).trim() !== "All";
  // Over-fetch when filtering by referral so we can still return up to safeLimit matches
  const fetchLimit = wantReferral
    ? Math.min(safeLimit * 25, 5000)
    : safeLimit;

  const useRange =
    dateFrom &&
    dateTo &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(dateFrom).trim()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(dateTo).trim());

  try {
    const sources = await resolveEventSources(
      useRange
        ? { dateFrom: String(dateFrom).trim(), dateTo: String(dateTo).trim() }
        : {},
    );
    if (sources.length === 0) return [];

    const fromTs = useRange ? String(dateFrom).trim() + " 00:00:00" : null;
    const toTs = useRange ? String(dateTo).trim() + " 23:59:59" : null;
    const referralWanted = wantReferral ? String(referralSource).trim() : null;

    const all = [];
    for (const src of sources) {
      let sql = `SELECT id, path, full_url, referrer, ip_address, device_type, value, currency, product_data, created_at
         FROM events
         WHERE event_type = ?`;
      const params = [String(eventType).trim()];
      if (useRange) {
        sql += " AND created_at >= ? AND created_at <= ?";
        params.push(fromTs, toTs);
      }
      sql = appendEventsSiteFilter(sql, params, urlContains);
      sql += ` ORDER BY created_at DESC LIMIT ${fetchLimit}`;
      const [rows] = await src.pool.execute(sql, params);
      for (const row of rows) {
        const referral_source = classifyReferralSource(row.referrer, row.full_url);
        if (referralWanted && referral_source !== referralWanted) continue;
        all.push({ ...row, referral_source });
      }
    }

    all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return all.slice(0, safeLimit);
  } catch (err) {
    console.error("[analytics] Failed to get events by type:", err);
    return null;
  }
}

/**
 * Get add to cart event counts grouped by time
 */
export async function getAddToCartByTime(
  granularity = "daily",
  urlContains = null,
  days = null,
) {
  return getEventsByTime("AddToCart", granularity, urlContains, days);
}

/**
 * Get event counts for a given event type grouped by time.
 * Queries live + monthly archive DBs as needed and merges periods.
 */
export async function getEventsByTime(
  eventType,
  granularity = "daily",
  urlContains = null,
  days = null,
  dateFrom = null,
  dateTo = null,
) {
  if (!eventType || typeof eventType !== "string") return null;

  const useCustomRange =
    dateFrom &&
    dateTo &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(dateFrom).trim()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(dateTo).trim());
  const lookBack =
    days != null
      ? Math.max(1, parseInt(days, 10))
      : granularity === "hourly"
        ? 7
        : 30;

  try {
    const sources = await resolveEventSources(
      useCustomRange
        ? { dateFrom: String(dateFrom).trim(), dateTo: String(dateTo).trim() }
        : { days: lookBack },
    );
    if (sources.length === 0) return [];

    const periodExpr =
      granularity === "hourly"
        ? `DATE_FORMAT(created_at, '%Y-%m-%d %H:00')`
        : `DATE(created_at)`;

    const merged = new Map();

    for (const src of sources) {
      let sql;
      const params = [];

      if (useCustomRange) {
        const from = String(dateFrom).trim() + " 00:00:00";
        const to = String(dateTo).trim() + " 23:59:59";
        sql = `SELECT ${periodExpr} AS period, COUNT(*) AS count
           FROM events
           WHERE event_type = ? AND created_at >= ? AND created_at <= ?`;
        params.push(String(eventType).trim(), from, to);
      } else {
        sql = `SELECT ${periodExpr} AS period, COUNT(*) AS count
           FROM events
           WHERE event_type = ? AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? DAY)`;
        params.push(String(eventType).trim(), lookBack);
      }

      sql = appendEventsSiteFilter(sql, params, urlContains);
      sql += " GROUP BY period";

      const [rows] = await src.pool.execute(sql, params);
      for (const r of rows) {
        const key = String(r.period);
        merged.set(key, (merged.get(key) || 0) + Number(r.count));
      }
    }

    return [...merged.entries()]
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => String(a.period).localeCompare(String(b.period)));
  } catch (err) {
    console.error("[analytics] Failed to get events by time:", err);
    return null;
  }
}

/**
 * List available monthly archive databases.
 */
export async function getArchiveMonths() {
  try {
    return await listArchiveMonths();
  } catch (err) {
    console.error("[analytics] Failed to list archives:", err);
    return [];
  }
}

/**
 * Get recent unique users
 */
export async function getRecentUniqueUsers(limit = DEFAULT_LIST_LIMIT, urlContains = null) {
  const db = getDb();
  if (!db) return null;

  const safeLimit = clampLimit(limit);

  try {
    let sql = `SELECT ip_address, device_type, country, city, district, visit_count, last_seen, full_url
       FROM unique_users`;
    const params = [];
    sql = appendUniqueUsersSiteFilter(sql, params, urlContains, false);
    sql += ` ORDER BY last_seen DESC LIMIT ${safeLimit}`;
    const [rows] = await db.execute(sql, params);
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get recent users:", err);
    return null;
  }
}

/**
 * Recent events for one IP (detail panel). Bounded, slim columns, parameterized site filter.
 */
export async function getEventsByIpGrouped(
  ip = null,
  site_url = null,
  limit = DEFAULT_IP_EVENTS_LIMIT,
  days = 0,
) {
  const db = getDb();
  if (!db || !ip) return null;

  const safeLimit = clampLimit(limit, DEFAULT_IP_EVENTS_LIMIT, MAX_IP_EVENTS_LIMIT);

  try {
    let sql = `SELECT id, event_type, path, full_url, host, ip_address, device_type,
              value, currency, product_data, created_at
       FROM events
       WHERE ip_address = ?`;
    const params = [String(ip).trim()];
    sql = appendEventsSiteFilter(sql, params, site_url);
    const lookBack = parseDaysParam(days, 0);
    if (lookBack > 0) {
      sql = appendCreatedAtWindow(sql, params, lookBack);
    }
    sql += ` ORDER BY created_at DESC LIMIT ${safeLimit}`;
    const [rows] = await db.execute(sql, params);
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get events by ip grouped:", err);
    return null;
  }
}

/**
 * Batch event-type counts for many IPs in one query (kills Users-page N+1).
 * @returns {{ [ip: string]: { pageview: number, view_item: number, add_to_cart: number, purchase: number } }}
 */
export async function getEventStatsByIps(ips = [], site_url = null, days = 0) {
  const db = getDb();
  if (!db) return null;

  const uniqueIps = [
    ...new Set(
      (Array.isArray(ips) ? ips : String(ips).split(","))
        .map((ip) => String(ip || "").trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_STATS_IPS);

  const emptyStat = () => ({
    pageview: 0,
    view_item: 0,
    add_to_cart: 0,
    purchase: 0,
  });

  const result = {};
  for (const ip of uniqueIps) result[ip] = emptyStat();
  if (uniqueIps.length === 0) return result;

  try {
    const placeholders = uniqueIps.map(() => "?").join(", ");
    let sql = `SELECT ip_address, event_type, COUNT(*) AS count
       FROM events
       WHERE ip_address IN (${placeholders})`;
    const params = [...uniqueIps];
    sql = appendEventsSiteFilter(sql, params, site_url);
    const lookBack = parseDaysParam(days, 0);
    if (lookBack > 0) {
      sql = appendCreatedAtWindow(sql, params, lookBack);
    }
    sql += " GROUP BY ip_address, event_type";

    const [rows] = await db.execute(sql, params);
    for (const row of rows) {
      const ip = row.ip_address;
      if (!result[ip]) result[ip] = emptyStat();
      const count = Number(row.count) || 0;
      switch (row.event_type) {
        case "PageView":
          result[ip].pageview += count;
          break;
        case "ViewItem":
          result[ip].view_item += count;
          break;
        case "AddToCart":
          result[ip].add_to_cart += count;
          break;
        case "Purchase":
          result[ip].purchase += count;
          break;
        default:
          break;
      }
    }
    return result;
  } catch (err) {
    console.error("[analytics] Failed to get event stats by ips:", err);
    return null;
  }
}
