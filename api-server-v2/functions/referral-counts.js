/**
 * Precomputed referral source counters by event type
 * (Google × PageView / AddToCart / Purchase, …).
 */

import { getDb } from "./db.js";
import { normalizeSiteKey, siteKeyFromEvent } from "./site-key.js";
import { classifyReferralSource } from "./referral-source.js";

const BREAKDOWN_TYPES = [
  "PageView",
  "ViewItem",
  "ViewContent",
  "AddToCart",
  "ViewCart",
  "InitiateCheckout",
  "Purchase",
  "RemoveFromCart",
];

function emptyBreakdown() {
  const o = { total: 0 };
  for (const t of BREAKDOWN_TYPES) o[t] = 0;
  o.Other = 0;
  return o;
}

/**
 * Increment after an event insert.
 */
export async function incrementReferralCount(db, event) {
  if (!db || !event) return;
  const siteKey = siteKeyFromEvent(event);
  const source = classifyReferralSource(event.referrer, event.full_url);
  const eventType = String(event.event || event.event_type || "PageView").trim() || "PageView";
  if (!source) return;

  try {
    await db.execute(
      `INSERT INTO referral_counts (site_key, source, event_type, day, count)
       VALUES (?, ?, ?, CURDATE(), 1)
       ON DUPLICATE KEY UPDATE count = count + 1`,
      [siteKey, source, eventType],
    );
  } catch (err) {
    console.error("[referral-counts] Failed to increment:", err.message);
  }
}

/**
 * Site filter that matches store domain even when site_url is a full URL.
 */
function appendSiteFilter(sql, params, urlContains) {
  const site = normalizeSiteKey(urlContains);
  if (!site) return sql;
  sql +=
    " AND (site_key = ? OR site_key = ? OR site_key LIKE ? OR site_key LIKE ?)";
  params.push(site, "www." + site, "%." + site, "%" + site + "%");
  return sql;
}

/**
 * Aggregated referral report with per-event-type breakdown.
 * @param {string|null} urlContains
 * @param {number} days - lookback days; ignored when dateFrom+dateTo set; 0 = all time
 * @param {string|null} dateFrom - YYYY-MM-DD inclusive
 * @param {string|null} dateTo - YYYY-MM-DD inclusive
 * @returns {{ data: Array<object>, totalCount: number, columns: string[] }}
 */
export async function getReferralCounts(
  urlContains = null,
  days = 30,
  dateFrom = null,
  dateTo = null,
) {
  const db = getDb();
  if (!db) return null;

  try {
    let sql = `SELECT source, event_type, SUM(count) AS count
       FROM referral_counts
       WHERE 1=1`;
    const params = [];
    sql = appendSiteFilter(sql, params, urlContains);

    const useCustomRange =
      dateFrom &&
      dateTo &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(dateFrom).trim()) &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(dateTo).trim());

    if (useCustomRange) {
      sql += " AND day >= ? AND day <= ?";
      params.push(String(dateFrom).trim(), String(dateTo).trim());
    } else {
      const lookBack = parseInt(days, 10);
      if (Number.isFinite(lookBack) && lookBack > 0) {
        sql += " AND day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)";
        params.push(lookBack);
      }
    }

    sql += " GROUP BY source, event_type";
    const [rows] = await db.execute(sql, params);

    const bySource = new Map();
    for (const r of rows) {
      const source = r.source || "Other";
      if (!bySource.has(source)) bySource.set(source, emptyBreakdown());
      const row = bySource.get(source);
      const n = Number(r.count) || 0;
      const et = r.event_type || "Other";
      if (BREAKDOWN_TYPES.includes(et)) {
        row[et] += n;
      } else {
        row.Other += n;
      }
      row.total += n;
    }

    const data = [...bySource.entries()]
      .map(([source, counts]) => ({ source, ...counts }))
      .sort((a, b) => b.total - a.total);

    const totalCount = data.reduce((acc, row) => acc + row.total, 0);
    return {
      data,
      totalCount,
      columns: [...BREAKDOWN_TYPES, "Other"],
    };
  } catch (err) {
    console.error("[referral-counts] Failed to get counts:", err);
    return null;
  }
}
