/**
 * Framework-agnostic event handler
 * This can be used with Next.js, Express, Fastify, or any other framework
 * 
 * @param {Object} eventData - The event data from the client
 * @param {Object} req - The request object (Next.js Request, Express req, etc.)
 * @returns {Promise<Object>} - Response object with success status
 */

import { getDb } from "./db.js";
import { sendFbEvent } from "./fb-pixel.js";
import {
  getClientIp,
  detectDeviceType,
  getIpGeolocation,
} from "./utils.js";

/**
 * Process an analytics event
 * This is the main handler that can be used by any framework
 */
export async function processEvent(eventData, req) {
  // Extract host and user agent
  let host = null;
  let userAgent = eventData.ua || "";

  // Handle different request object types
  if (req && typeof req.headers.get === "function") {
    // Next.js Request object
    host = req.headers.get("host");
    userAgent = userAgent || req.headers.get("user-agent") || "";
  } else if (req && req.headers) {
    // Standard headers object (Express, Fastify, etc.)
    host = req.headers.host || req.headers.Host || req.headers["host"];
    userAgent = userAgent || req.headers["user-agent"] || req.headers["User-Agent"] || "";
  }

  // Extract IP and detect device
  const ipAddress = getClientIp(req);
  const deviceType = detectDeviceType(userAgent);

  const event = {
    host,
    path: eventData.path || null,
    referrer: eventData.referrer || null,
    ua: userAgent,
    email: eventData.email || null,
    phone: eventData.phone || null,
    ts: eventData.ts || Date.now(),
    event: eventData.event || "PageView", // Event type: PageView, AddToCart, Purchase
    product: eventData.product || null,
    products: eventData.products || null,
    value: eventData.value || null,
    currency: eventData.currency || null,
    event_id: eventData.event_id || null, // Event ID for deduplication
    ipAddress,
    deviceType,
  };

  // Get geolocation (async, don't block)
  let geolocation = null;
  try {
    geolocation = await getIpGeolocation(ipAddress);
  } catch (err) {
    console.error("[analytics] Failed to get geolocation:", err);
  }

  // Save to MySQL if configured
  try {
    const db = getDb();
    if (db) {
      // Prepare product data as JSON
      let productData = null;
      if (event.product) {
        productData = JSON.stringify(event.product);
      } else if (event.products) {
        productData = JSON.stringify(event.products);
      }

      // Insert event
      await db.execute(
        `INSERT INTO events (
          event_type, host, path, referrer, ua, ip_address, device_type, ts, product_data, value, currency
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.event,
          event.host,
          event.path,
          event.referrer,
          event.ua,
          ipAddress,
          deviceType,
          event.ts,
          productData,
          event.value || null,
          event.currency || null,
        ]
      );

      // Check if IP exists in unique_users
      let exists = false;
      try {
        const [rows] = await db.execute(
          "SELECT 1 FROM unique_users WHERE ip_address = ? LIMIT 1",
          [ipAddress]
        );
        if (rows && rows.length > 0) {
          exists = true;
        }
      } catch (err) {
        console.error("[utils] Failed to check IP existence in DB:", err);
      }

      if (!exists) {
        if (geolocation) {
          await db.execute(
            `INSERT INTO unique_users (
              ip_address, device_type, user_agent, country, region, city, district, latitude, longitude, visit_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
              last_seen = CURRENT_TIMESTAMP,
              visit_count = visit_count + 1,
              country = COALESCE(?, country),
              region = COALESCE(?, region),
              city = COALESCE(?, city),
              district = COALESCE(?, district),
              latitude = COALESCE(?, latitude),
              longitude = COALESCE(?, longitude)`,
            [
              ipAddress,
              deviceType,
              userAgent,
              geolocation.country,
              geolocation.region,
              geolocation.city,
              geolocation.district,
              geolocation.latitude,
              geolocation.longitude,
              geolocation.country,
              geolocation.region,
              geolocation.city,
              geolocation.district,
              geolocation.latitude,
              geolocation.longitude,
            ]
          );
        } else {
          // Insert without geolocation
          await db.execute(
            `INSERT INTO unique_users (
              ip_address, device_type, user_agent, visit_count
            ) VALUES (?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
              last_seen = CURRENT_TIMESTAMP,
              visit_count = visit_count + 1`,
            [ipAddress, deviceType, userAgent]
          );
        }
      } else {
        await db.execute(
          `UPDATE unique_users SET
            last_seen = CURRENT_TIMESTAMP,
            visit_count = visit_count + 1
          WHERE ip_address = ?`,
          [ipAddress]
        );
      }
    }
  } catch (err) {
    console.error("[analytics] Failed to insert event into MySQL:", err);
  }

  // Send to Facebook Conversions API (server-side tracking)
  try {
    const res = await sendFbEvent(event, req);
    // console.log("[analytics] FB Pixel response:", res);
    // console.log("[analytics] FB Pixel response:", res);
  } catch (err) {
    console.error("[analytics] Failed to send FB Pixel event:", err);
  }

  return { ok: true };
}
