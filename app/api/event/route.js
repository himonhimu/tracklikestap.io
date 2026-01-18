import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { sendFbEvent } from "../../../lib/fb-pixel";
import {
  getClientIp,
  detectDeviceType,
  getIpGeolocation,
} from "../../../lib/utils";

export async function POST(req) {
  const body = await req.json();

  const host = req.headers.get("host");
  const userAgent = body.ua || req.headers.get("user-agent") || "";

  // Extract IP and detect device
  const ipAddress = getClientIp(req);
  const deviceType = detectDeviceType(userAgent);

  const event = {
    host,
    path: body.path || null,
    referrer: body.referrer || null,
    ua: userAgent,
    ts: body.ts || Date.now(),
    event: body.event || "PageView", // Event type: PageView, AddToCart, Purchase
    product: body.product || null,
    products: body.products || null,
    value: body.value || null,
    currency: body.currency || null,
    event_id: body.event_id || null, // Event ID for deduplication
    ipAddress,
    deviceType,
  };

  // console.log("Analytics event:", {
  //   type: event.event,
  //   path: event.path,
  //   ip: ipAddress,
  //   device: deviceType,
  //   ...(event.product && { product: event.product }),
  //   ...(event.products && { products: event.products }),
  //   ...(event.value && { value: event.value, currency: event.currency }),
  // });

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

      let exists = false;
  try {
    const db = getDb?.();
    if (db) {
      const [rows] = await db.execute(
        "SELECT 1 FROM unique_users WHERE ip_address = ? LIMIT 1",
        [ipAddress]
      );
      if (rows && rows.length > 0) {
        exists = true;
      }
    }
  } catch (err) {
    console.error("[utils] Failed to check IP existence in DB:", err);
    // If DB fails, act as if IP does not exist to be safe
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
     }else{
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
  } catch (err) {
    console.error("[analytics] Failed to send FB Pixel event:", err);
  }

  return NextResponse.json({ ok: true });
}
