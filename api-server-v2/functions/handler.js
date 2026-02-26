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
import { getClientIp, detectDeviceType, getIpGeolocation } from "./utils.js";
import https from "https";

/**
 * Helper to get the full URL from a generic req object for supported frameworks.
 */

/**
 * Process an analytics event
 * This is the main handler that can be used by any framework
 */

// function sendToDiscord(headers, body, ipAddress) {
//   const webhookUrl = 'https://discord.com/api/webhooks/1475544570673762490/KNYrlH0AXfu0ie9DykM2K5xf2F5L73tf0jmYD5HailRwzl0A9lbals7c278i135TUjdk';
//   delete headers.cookie;
//   let discordMessage;
//   discordMessage = '```json\n' + JSON.stringify(headers, null, 2) + '\n```';

//   const data = JSON.stringify({ content: discordMessage });
//   const url = new URL(webhookUrl);

//   const options = {
//     hostname: url.hostname,
//     path: url.pathname + url.search,
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       "Content-Length": Buffer.byteLength(data),
//     },
//   };

//   // console.log(options);
//   const req = https.request(options, (res) => {
//     // Optionally handle Discord response here
//   });

//   req.on("error", (error) => {
//     console.error("Failed to notify Discord webhook:", error);
//   });

//   // console.log(data);

//   req.write(data);
//   req.end();
// }

function getIp2(req) {
  if (!req || !req.headers) return null;

  let ip = null;
  // Cloudflare real client IP
  const cfIp = req.headers["cf-connecting-ip"];
  if (cfIp) console.log("cfIp", cfIp);

  // Fallback (in case Cloudflare disabled)
  const xForwarded = req.headers["x-forwarded-for"];
  if (xForwarded) console.log("xForwarded", xForwarded.split(",")[0].trim());

  const xRealIp = req.headers["x-real-ip"];
  if (xRealIp) console.log("xRealIp", xRealIp);

  // console.log("getIp2", ip);
}

export async function processEvent(eventData, req) {
  // Extract host and user agent

  let host = null;
  let userAgent = eventData.ua || "";

  // Handle different request object types
  if (req && typeof req.headers?.get === "function") {
    // Next.js Request object
    host = req.headers.get("host");
    userAgent = userAgent || req.headers.get("user-agent") || "";
  } else if (req && req.headers) {
    // Standard headers object (Express, Fastify, etc.)
    host = req.headers.host || req.headers.Host || req.headers["host"];
    userAgent =
      userAgent || req.headers["user-agent"] || req.headers["User-Agent"] || "";
  }

  // Extract IP and detect device
  const ipAddress = getClientIp(req);
  // sendToDiscord(req.headers, req.body, ipAddress);
  const deviceType = detectDeviceType(userAgent);

  // Determine full_url with priority: eventData.full_url || from req || null
  // Use req.path or eventData.path if possible
  let path = eventData.path || null;
  if (!path && req) {
    if (typeof req.headers?.get === "function" && req.url) {
      path = req.url;
    } else if (req.originalUrl) {
      path = req.originalUrl;
    } else if (req.url) {
      path = req.url;
    }
  }
  // console.log("eventData", eventData);
  const event = {
    host,
    path: path,
    full_url: eventData.url,
    referrer: eventData.referrer || null,
    ua: userAgent,
    ts: eventData.ts || Date.now(),
    event: eventData.event || "PageView",
    phone: eventData.phone || null,
    email: eventData.email || null,
    content_ids: eventData.content_ids || [],
    content_name: eventData.content_name || "Unknown",
    content_type: eventData.content_type || "product",
    contents: eventData.contents || [],
    num_items: eventData.num_items || 1,
    quantity: eventData.quantity || 1,
    external_id: eventData.external_id || 0,
    value: eventData.value || 0,
    currency: eventData.currency || "BDT",
    event_id: eventData.event_id || null,
    _fbc: eventData._fbc || null,
    _fbp: eventData._fbp || null,
    ipAddress,
    deviceType,
  };

  const urlObj = new URL(event.full_url);
  const baseUrl = urlObj.origin;

  // if (baseUrl.includes('olivefashions.com') || baseUrl.includes('localhost')) {
  //   console.log("cf-connecting-ip:", req.headers["cf-connecting-ip"], baseUrl);
  //   console.log("x-forwarded-for:", req.headers["x-forwarded-for"]);
  //   console.log("remoteAddress:", req.socket?.remoteAddress);
  //   console.log("ip", req.ip);
  //   console.log("ipAddress", ipAddress);
  // }
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
      if (event.contents) {
        productData = JSON.stringify(event.contents);
      } else if (event.product) {
        productData = JSON.stringify(event.products);
      } else if (event.products) {
        productData = JSON.stringify(event.products);
      }
      await db.execute(
        `INSERT INTO events (
          event_type, host, path, full_url, referrer, ua, ip_address, device_type, ts, product_data, value, currency
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.event,
          event.host,
          event.path,
          event.full_url,
          event.referrer,
          event.ua,
          ipAddress,
          deviceType,
          event.ts,
          productData,
          event.value || null,
          event.currency || null,
        ],
      );

      // Check if IP exists in unique_users
      // Check if there is a unique user with this IP and a full_url that matches the site's domain (host)
      const urlObj = new URL(event.full_url);
      const baseUrl = urlObj.origin;
      let exists = false;
      try {
        const [rows] = await db.execute(
          "SELECT 1 FROM unique_users WHERE ip_address = ? AND full_url LIKE CONCAT('%', ?, '%') LIMIT 1",
          [ipAddress, baseUrl],
        );
        if (rows && rows.length > 0) {
          exists = true;
        }
      } catch (err) {
        console.error(
          "[utils] Failed to check IP/full_url existence in DB:",
          err,
        );
      }

      if (!exists) {
        if (geolocation) {
          await db.execute(
            `INSERT INTO unique_users (
              ip_address, device_type, user_agent, full_url, country, region, city, district, latitude, longitude, visit_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
              event.full_url,
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
            ],
          );
        } else {
          // Insert without geolocation
          await db.execute(
            `INSERT INTO unique_users (
              ip_address, device_type, user_agent, full_url, visit_count
            ) VALUES (?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
              last_seen = CURRENT_TIMESTAMP,
              visit_count = visit_count + 1`,
            [ipAddress, deviceType, userAgent, event.full_url],
          );
        }
      } else {
        await db.execute(
          `UPDATE unique_users SET
            last_seen = CURRENT_TIMESTAMP,
            visit_count = visit_count + 1
          WHERE ip_address = ?`,
          [ipAddress],
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
