/**
 * Example queries for analytics data
 * Use these in your dashboard or API routes
 */

import { getDb } from "./db";

/**
 * Get total unique users count
 */
export async function getTotalUniqueUsers() {
  const db = getDb();
  if (!db) return null;

  try {
    const [rows] = await db.execute(
      "SELECT COUNT(*) as count FROM unique_users"
    );
    return rows[0].count;
  } catch (err) {
    console.error("[analytics] Failed to get unique users:", err);
    return null;
  }
}

/**
 * Get unique users by device type
 */
export async function getUniqueUsersByDevice() {
  const db = getDb();
  if (!db) return null;

  try {
    const [rows] = await db.execute(
      `SELECT device_type, COUNT(*) as count 
       FROM unique_users 
       GROUP BY device_type`
    );
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get users by device:", err);
    return null;
  }
}

/**
 * Get unique users by location
 */
export async function getUniqueUsersByLocation() {
  const db = getDb();
  if (!db) return null;

  try {
    const [rows] = await db.execute(
      `SELECT country, region, city, district, COUNT(*) as count 
       FROM unique_users 
       WHERE country IS NOT NULL
       GROUP BY country, region, city, district
       ORDER BY count DESC
       LIMIT 100`
    );
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get users by location:", err);
    return null;
  }
}

/**
 * Get event counts by type
 */
export async function getEventCounts() {
  const db = getDb();
  if (!db) return null;

  try {
    const [rows] = await db.execute(
      `SELECT event_type, COUNT(*) as count 
       FROM events 
       GROUP BY event_type`
    );
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get event counts:", err);
    return null;
  }
}

/**
 * Get purchase events with details
 */
export async function getPurchaseEvents(limit = 50) {
  const db = getDb();
  if (!db) return null;

  try {
    const [rows] = await db.execute(
      `SELECT id, path, ip_address, device_type, value, currency, product_data, created_at
       FROM events 
       WHERE event_type = 'Purchase'
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get purchase events:", err);
    return null;
  }
}

/**
 * Get add to cart events
 */
export async function getAddToCartEvents(limit = 50) {
  const db = getDb();
  if (!db) return null;

  try {
    const [rows] = await db.execute(
      `SELECT id, path, ip_address, device_type, product_data, created_at
       FROM events 
       WHERE event_type = 'AddToCart'
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get add to cart events:", err);
    return null;
  }
}

/**
 * Get recent unique users
 */
export async function getRecentUniqueUsers(limit = 50) {
  const db = getDb();
  if (!db) return null;

  try {
    const [rows] = await db.execute(
      `SELECT ip_address, device_type, country, city, district, visit_count, last_seen
       FROM unique_users 
       ORDER BY last_seen DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (err) {
    console.error("[analytics] Failed to get recent users:", err);
    return null;
  }
}
