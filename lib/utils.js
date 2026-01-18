/**
 * Utility functions for analytics
 */

import { getDb } from "./db";

/**
 * Generate a unique event ID (UUID v4)
 * Works in both browser and Node.js environments
 */
export function generateEventId() {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    // Browser environment with crypto.randomUUID support
    return window.crypto.randomUUID();
  }
  
  // Fallback for Node.js or older browsers
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Manual UUID v4 generation fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Extract client IP address from request
 */
export function getClientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  if (realIp) {
    return realIp.trim();
  }
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  return "0.0.0.0";
}

/**
 * Detect device type from user agent
 */
export function detectDeviceType(userAgent) {
  if (!userAgent) return "unknown";

  const ua = userAgent.toLowerCase();

  // Mobile devices
  if (
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)
  ) {
    return "mobile";
  }

  // Tablet devices
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return "tablet";
  }

  // Desktop
  return "desktop";
}

/**
 * Get geolocation from IP address using ip-api.com
 * Only sends a request to ip-api if the user (ip) does NOT exist in our DB.
 */
export async function getIpGeolocation(ip) {
  // Skip localhost/private IPs
  if (
    !ip ||
    ip === "0.0.0.0" ||
    ip.startsWith("127.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.")
  ) {
    return {
      country: null,
      region: null,
      city: null,
      district: null,
      latitude: null,
      longitude: null,
    };
  }

  // Check if IP exists in the database
  let exists = false;
  try {
    const db = getDb?.();
    if (db) {
      const [rows] = await db.execute(
        "SELECT 1 FROM unique_users WHERE ip_address = ? LIMIT 1",
        [ip]
      );
      if (rows && rows.length > 0) {
        exists = true;
      }
    }
  } catch (err) {
    // console.error("[utils] Failed to check IP existence in DB:", err);
    // If DB fails, act as if IP does not exist to be safe
  }

  if (exists) {
    // If user exists in the db, don't send request to ip-api, just return null geolocation
    return {
      country: null,
      region: null,
      city: null,
      district: null,
      latitude: null,
      longitude: null,
    };
  }

  try {
    // Using ip-api.com (45 requests/minute for free)
    // Docs: http://ip-api.com/docs/api:json
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,region,regionName,city,district,lat,lon,message`, {
      headers: {
        "User-Agent": "tracklikestap.io",
      },
    });

    if (!response.ok) {
      return {
        country: null,
        region: null,
        city: null,
        district: null,
        latitude: null,
        longitude: null,
      };
    }

    const data = await response.json();

    if (data.status !== "success") {
      return {
        country: null,
        region: null,
        city: null,
        district: null,
        latitude: null,
        longitude: null,
      };
    }

    return {
      country: data.country || null,
      region: data.regionName || data.region || null,
      city: data.city || null,
      district: data.district || null,
      latitude: data.lat || null,
      longitude: data.lon || null,
    };
  } catch (err) {
    console.error("[utils] Failed to get geolocation:", err);
    return {
      country: null,
      region: null,
      city: null,
      district: null,
      latitude: null,
      longitude: null,
    };
  }
}
