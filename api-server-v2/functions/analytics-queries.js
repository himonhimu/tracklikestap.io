/**
 * Example queries for analytics data
 * Use these in your dashboard or API routes
 */

import { getDb } from "./db.js";

/**
 * Get total unique users count
 * @param {string|null} urlContains - optional: filter where full_url contains this string (e.g. "nextlifestyle.store")
 */
export async function getTotalUniqueUsers(urlContains = null) {
  const db = getDb();
  if (!db) return null;

  try {
    let sql = "SELECT COUNT(*) as count FROM unique_users";
    const params = [];
    if (urlContains && String(urlContains).trim()) {
      sql += " WHERE full_url LIKE ?";
      params.push("%" + String(urlContains).trim() + "%");
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
 * @param {string|null} urlContains - optional: filter where full_url contains this string
 */
export async function getUniqueUsersByDevice(urlContains = null) {
  const db = getDb();
  if (!db) return null;

  try {
    let sql = `SELECT device_type, COUNT(*) as count 
       FROM unique_users`;
    const params = [];
    if (urlContains && String(urlContains).trim()) {
      sql += " WHERE full_url LIKE ?";
      params.push("%" + String(urlContains).trim() + "%");
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
 * @param {string|null} urlContains - optional: filter where full_url contains this string
 */
export async function getUniqueUsersByLocation(urlContains = null) {
  const db = getDb();
  if (!db) return null;

  try {
    let sql = `SELECT country, region, city, district, COUNT(*) as count 
       FROM unique_users 
       WHERE country IS NOT NULL`;
    const params = [];
    if (urlContains && String(urlContains).trim()) {
      sql += " AND full_url LIKE ?";
      params.push("%" + String(urlContains).trim() + "%");
    }
    sql += " GROUP BY country, region, city, district ORDER BY count DESC LIMIT 100";
    const [rows] = await db.execute(sql, params);
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get users by location:", err);
    return null;
  }
}

/**
 * Get event counts by type
 * @param {string|null} urlContains - optional: filter where full_url, path, or host contains this string
 */
export async function getEventCounts(urlContains = null) {
  const db = getDb();
  if (!db) return null;

  try {
    let sql = `SELECT event_type, COUNT(*) as count 
       FROM events`;
    const params = [];
    if (urlContains && String(urlContains).trim()) {
      const like = "%" + String(urlContains).trim() + "%";
      sql += " WHERE (full_url LIKE ? OR path LIKE ? OR host LIKE ?)";
      params.push(like, like, like);
    }
    sql += " GROUP BY event_type";
    const [rows] = await db.execute(sql, params);
    const totalCount = rows.reduce((acc, row) => acc + row.count, 0);
    return {
      data: rows,
      totalCount: totalCount
    };
  } catch (err) {
    console.error("[analytics] Failed to get event counts:", err);
    return null;
  }
}

/**
 * Get purchase events with details
 * @param {number} limit
 * @param {string|null} urlContains - optional: filter where full_url, path, or host contains this string
 */
export async function getPurchaseEvents(limit = 50, urlContains = null) {
  const db = getDb();
  if (!db) return null;

  try {
    let sql = `SELECT id, path, full_url, ip_address, device_type, value, currency, product_data, created_at
       FROM events 
       WHERE event_type = 'Purchase'`;
    const params = [];
    if (urlContains && String(urlContains).trim()) {
      const like = "%" + String(urlContains).trim() + "%";
      sql += " AND (full_url LIKE ? OR path LIKE ? OR host LIKE ?)";
      params.push(like, like, like);
    }
    sql += ` ORDER BY created_at DESC LIMIT ${limit}`;
    const [rows] = await db.execute(sql, params);
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get purchase events:", err);
    return null;
  }
}

/**
 * Get add to cart events
 * @param {number} limit
 * @param {string|null} urlContains - optional: filter where full_url, path, or host contains this string
 */
export async function getAddToCartEvents(limit = 50, urlContains = null) {
  return getEventsByType('AddToCart', limit, urlContains);
}

/**
 * Get recent events for any event type
 * @param {string} eventType - e.g. 'Purchase', 'AddToCart', 'PageView'
 * @param {number} limit
 * @param {string|null} urlContains - optional: filter where full_url, path, or host contains this string
 */
export async function getEventsByType(eventType, limit = 50, urlContains = null) {
  const db = getDb();
  if (!db || !eventType || typeof eventType !== 'string') return null;

  try {
    let sql = `SELECT id, path, full_url, ip_address, device_type, value, currency, product_data, created_at
       FROM events 
       WHERE event_type = ?`;
    const params = [String(eventType).trim()];
    if (urlContains && String(urlContains).trim()) {
      const like = "%" + String(urlContains).trim() + "%";
      sql += " AND (full_url LIKE ? OR path LIKE ? OR host LIKE ?)";
      params.push(like, like, like);
    }
    sql += ` ORDER BY created_at DESC LIMIT ${limit}`;
    const [rows] = await db.execute(sql, params);
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get events by type:", err);
    return null;
  }
}

/**
 * Get add to cart event counts grouped by time (hourly or daily)
 * @param {'hourly'|'daily'} granularity
 * @param {string|null} urlContains - optional: filter where full_url, path, or host contains this string
 * @param {number} days - number of days to look back (default 30 for daily, 7 for hourly to limit points)
 */
export async function getAddToCartByTime(granularity = 'daily', urlContains = null, days = null) {
  return getEventsByTime('AddToCart', granularity, urlContains, days);
}

/**
 * Get event counts for a given event type grouped by time (hourly or daily)
 * @param {string} eventType - e.g. 'Purchase', 'AddToCart'
 * @param {'hourly'|'daily'} granularity
 * @param {string|null} urlContains - optional: filter where full_url, path, or host contains this string
 * @param {number|null} days - number of days to look back (used when dateFrom/dateTo not provided)
 * @param {string|null} dateFrom - optional YYYY-MM-DD start date (inclusive)
 * @param {string|null} dateTo - optional YYYY-MM-DD end date (inclusive)
 */
export async function getEventsByTime(eventType, granularity = 'daily', urlContains = null, days = null, dateFrom = null, dateTo = null) {
  const db = getDb();
  if (!db || !eventType || typeof eventType !== 'string') return null;

  const useCustomRange = dateFrom && dateTo && /^\d{4}-\d{2}-\d{2}$/.test(String(dateFrom).trim()) && /^\d{4}-\d{2}-\d{2}$/.test(String(dateTo).trim());
  const lookBack = days != null ? Math.max(1, parseInt(days, 10)) : (granularity === 'hourly' ? 7 : 30);

  try {
    let sql;
    const params = [];

    if (useCustomRange) {
      const from = String(dateFrom).trim() + " 00:00:00";
      const to = String(dateTo).trim() + " 23:59:59";
      if (granularity === 'hourly') {
        sql = `SELECT 
          DATE_FORMAT(created_at, '%Y-%m-%d %H:00') AS period,
          COUNT(*) AS count
         FROM events 
         WHERE event_type = ? AND created_at >= ? AND created_at <= ?`;
        params.push(String(eventType).trim(), from, to);
      } else {
        sql = `SELECT 
          DATE(created_at) AS period,
          COUNT(*) AS count
         FROM events 
         WHERE event_type = ? AND created_at >= ? AND created_at <= ?`;
        params.push(String(eventType).trim(), from, to);
      }
    } else {
      if (granularity === 'hourly') {
        sql = `SELECT 
          DATE_FORMAT(created_at, '%Y-%m-%d %H:00') AS period,
          COUNT(*) AS count
         FROM events 
         WHERE event_type = ? AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? DAY)`;
        params.push(String(eventType).trim(), lookBack);
      } else {
        sql = `SELECT 
          DATE(created_at) AS period,
          COUNT(*) AS count
         FROM events 
         WHERE event_type = ? AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? DAY)`;
        params.push(String(eventType).trim(), lookBack);
      }
    }

    if (urlContains && String(urlContains).trim()) {
      const like = "%" + String(urlContains).trim() + "%";
      sql += " AND (full_url LIKE ? OR path LIKE ? OR host LIKE ?)";
      params.push(like, like, like);
    }

    sql += " GROUP BY period ORDER BY period ASC";
    const [rows] = await db.execute(sql, params);
    return rows.map((r) => ({ period: r.period, count: Number(r.count) }));
  } catch (err) {
    console.error("[analytics] Failed to get events by time:", err);
    return null;
  }
}

/**
 * Get recent unique users
 * @param {number} limit
 * @param {string|null} urlContains - optional: filter where full_url contains this string
 */
export async function getRecentUniqueUsers(limit = 50, urlContains = null) {
  const db = getDb();
  if (!db) return null;

  try {
    let sql = `SELECT ip_address, device_type, country, city, district, visit_count, last_seen, full_url
       FROM unique_users`;
    const params = [];
    if (urlContains && String(urlContains).trim()) {
      sql += " WHERE full_url LIKE ?";
      params.push("%" + String(urlContains).trim() + "%");
    }
    sql += ` ORDER BY last_seen DESC LIMIT ${limit}`;
    const [rows] = await db.execute(sql, params);
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get recent users:", err);
    return null;
  }
}
