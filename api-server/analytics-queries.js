/**
 * Example queries for analytics data
 * Use these in your dashboard or API routes
 */

import { getDb } from "./db.js";

/**
 * Utility to safely limit SQL bind parameters to numeric values.
 * Returns an integer greater than zero or a default fallback.
 * @param {any} val - value to sanitize
 * @param {number} fallback - fallback limit value
 */
function safeLimit(val, fallback = 50) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Get SQL fragment and parameter bindings for filtering `path` column using LIKE.
 * @param {string} path
 * @returns {{ clause: string, bindings: string[] }}
 */
function getPathQuery(path) {
  if (path) {
    const slugs = path
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (slugs.length > 0) {
      const likeClauses = slugs.map(() => `path LIKE ?`);
      return {
        clause: "AND (" + likeClauses.join(" OR ") + ")",
        bindings: slugs.map((slug) => `%${slug}%`),
      };
    }
  }
  return { clause: "", bindings: [] };
}

/**
 * Get total unique users count with optional path filter
 */
export async function getTotalUniqueUsers(req) {
  const path = req.query.url_contains;
  const db = getDb();
  if (!db) return null;

  const { clause, bindings } = getPathQuery(path);
  const sql = `SELECT COUNT(*) as count FROM unique_users WHERE 1=1 ${clause}`;
  try {
    const [rows] = await db.execute(sql, bindings);
    return rows[0]?.count ?? 0;
  } catch (err) {
    console.error("[analytics] Failed to get unique users:", err);
    return null;
  }
}

/**
 * Get unique users by device type
 */
export async function getUniqueUsersByDevice(req) {
  const path = req.query.url_contains;
  const { clause, bindings } = getPathQuery(path);
  const db = getDb();
  if (!db) return null;

  const sql = `SELECT device_type, COUNT(*) as count 
       FROM unique_users WHERE 1=1 ${clause}
       GROUP BY device_type`;
  try {
    const [rows] = await db.execute(sql, bindings);
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get users by device:", err);
    return null;
  }
}

/**
 * Get unique users by location
 */
export async function getUniqueUsersByLocation(req) {
  const path = req.query.url_contains;
  const { clause, bindings } = getPathQuery(path);
  const db = getDb();
  if (!db) return null;

  const sql = `SELECT country, city, district, COUNT(*) as count
       FROM unique_users
       WHERE 1=1 ${clause}
       GROUP BY country, city, district`;
  try {
    const [rows] = await db.execute(sql, bindings);
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get users by location:", err);
    return null;
  }
}

/**
 * Get event counts by type
 */
export async function getEventCounts(req) {
  const path = req.query.url_contains;
  const { clause, bindings } = getPathQuery(path);
  const db = getDb();
  if (!db) return null;

  const sql = `SELECT event_type, COUNT(*) as count 
    FROM events WHERE 1=1 ${clause}
    GROUP BY event_type`;
  try {
    const [rows] = await db.execute(sql, bindings);
    const totalCount = Array.isArray(rows)
      ? rows.reduce((acc, row) => acc + (row.count || 0), 0)
      : 0;
    return {
      data: rows,
      totalCount: totalCount,
    };
  } catch (err) {
    console.error("[analytics] Failed to get event counts:", err);
    return null;
  }
}

/**
 * Get purchase events with details
 */
export async function getPurchaseEvents(req, limit) {
  const path = req.query.url_contains;
  const { clause, bindings } = getPathQuery(path);
  const db = getDb();
  if (!db) return null;
  const realLimit = safeLimit(limit ?? req.query.limit);

  const sql = `SELECT id, path, ip_address, device_type, value, currency, product_data, created_at
       FROM events 
       WHERE event_type = 'Purchase' ${clause}
       ORDER BY created_at DESC
       LIMIT ${realLimit}`;
  const finalBindings = [...bindings];
  try {
    const [rows] = await db.execute(sql, finalBindings);
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get purchase events:", err);
    return null;
  }
}

/**
 * Get add to cart events
 */
export async function getAddToCartEvents(req, limit) {
  const path = req.query.url_contains;
  const { clause, bindings } = getPathQuery(path);
  const db = getDb();
  if (!db) return null;
  const realLimit = safeLimit(limit ?? req.query.limit);

  const sql = `SELECT id, path, ip_address, device_type, product_data, created_at
       FROM events 
       WHERE event_type = 'AddToCart' ${clause}
       ORDER BY created_at DESC
       LIMIT ?`;
  const finalBindings = [...bindings, realLimit];
  try {
    const [rows] = await db.execute(sql, finalBindings);
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get add to cart events:", err);
    return null;
  }
}

/**
 * Get recent unique users
 */
export async function getRecentUniqueUsers(req, limit) {
  const path = req.query.url_contains;
  const { clause, bindings } = getPathQuery(path);
  const db = getDb();
  if (!db) return null;
  const realLimit = safeLimit(limit ?? req.query.limit);

  const sql = `SELECT ip_address, device_type, country, city, district, visit_count, last_seen
       FROM unique_users 
       WHERE 1=1 ${clause}
       ORDER BY last_seen DESC
       LIMIT ${realLimit}`;
  const finalBindings = [...bindings];
  try {
    const [rows] = await db.execute(sql, finalBindings);
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get recent users:", err);
    return null;
  }
}
