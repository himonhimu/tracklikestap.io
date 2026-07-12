/**
 * Precomputed per-site, per-day event counters.
 * Updated on insert; Overview reads this instead of COUNT(*) on events.
 */

import { getDb } from "./db.js";
import { normalizeSiteKey, siteKeyFromEvent } from "./site-key.js";

/**
 * Increment counter after an event is inserted.
 */
export async function incrementEventCount(db, event) {
  if (!db || !event) return;
  const siteKey = siteKeyFromEvent(event);
  const eventType = String(event.event || event.event_type || "PageView").trim();
  if (!eventType) return;

  try {
    await db.execute(
      `INSERT INTO event_counts (site_key, event_type, day, count)
       VALUES (?, ?, CURDATE(), 1)
       ON DUPLICATE KEY UPDATE count = count + 1`,
      [siteKey, eventType],
    );
  } catch (err) {
    console.error("[event-counts] Failed to increment:", err.message);
  }
}

/**
 * Read aggregated counts from event_counts (fast).
 * @param {string|null} urlContains - site filter
 * @param {number} days - lookback; 0 = all time
 */
export async function getEventCountsFromSummary(urlContains = null, days = 30) {
  const db = getDb();
  if (!db) return null;

  try {
    let sql = `SELECT event_type, SUM(count) AS count
       FROM event_counts
       WHERE 1=1`;
    const params = [];

    const site = normalizeSiteKey(urlContains);
    if (site) {
      sql +=
        " AND (site_key = ? OR site_key = ? OR site_key LIKE ? OR site_key LIKE ?)";
      params.push(site, "www." + site, "%." + site, "%" + site + "%");
    }

    const lookBack = parseInt(days, 10);
    if (Number.isFinite(lookBack) && lookBack > 0) {
      sql += " AND day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)";
      params.push(lookBack);
    }

    sql += " GROUP BY event_type ORDER BY count DESC";
    const [rows] = await db.execute(sql, params);
    const data = rows.map((r) => ({
      event_type: r.event_type,
      count: Number(r.count) || 0,
    }));
    const totalCount = data.reduce((acc, row) => acc + row.count, 0);
    return { data, totalCount };
  } catch (err) {
    console.error("[event-counts] Failed to get counts:", err);
    return null;
  }
}

export { normalizeSiteKey, siteKeyFromEvent };
