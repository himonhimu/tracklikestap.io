/**
 * Utility functions for analytics
 */

import { getDb } from "./db.js"; 

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
 * Works with Next.js Request object, Express/Fastify req, or plain headers object
 * 
 * Priority order (important for ngrok/proxies):
 *   1. x-forwarded-for   (first IP in comma-separated list - real client IP)
 *   2. x-real-ip
 *   3. cf-connecting-ip (Cloudflare)
 *   4. true-client-ip (some proxies)
 *   5. req.ip (Express/Fastify - may be proxy IP)
 *   6. req.socket.remoteAddress (direct connection - may be ::1 or proxy IP)
 *   7. "0.0.0.0" (unknown/fallback)
 * 
 * Note: When using ngrok, x-forwarded-for contains the real client IP
 */
export function getClientIp(req) {
  if (!req) {
    return "0.0.0.0";
  }

  // Helper to extract first IP from comma-separated list
  const extractFirstIp = (value) => {
    if (!value) return null;
    const str = Array.isArray(value) ? value[0] : value;
    return str.split(",")[0].trim();
  };

  // Helper to get header value (handles both Next.js Headers and Express headers)
  const getHeaderValue = (headerName) => {
    if (!req || !req.headers) {
      return null;
    }
    
    // Next.js Request object (Headers instance)
    if (typeof req.headers.get === "function") {
      const value = req.headers.get(headerName) || req.headers.get(headerName.toLowerCase());
      if (value) return value;
    }
    
    // Express/Fastify headers object - check all possible case variations
    const headers = req.headers;
    const lowerName = headerName.toLowerCase();
    const upperName = headerName.toUpperCase();
    
    // Try exact match first
    if (headers[headerName]) return headers[headerName];
    if (headers[lowerName]) return headers[lowerName];
    if (headers[upperName]) return headers[upperName];
    
    // Try case-insensitive search through all header keys
    const headerKeys = Object.keys(headers);
    for (const key of headerKeys) {
      if (key.toLowerCase() === lowerName) {
        return headers[key];
      }
    }
    
    return null;
  };

  // Priority 1: x-forwarded-for (most important for ngrok/proxies)
  const xForwardedFor = getHeaderValue("x-forwarded-for");
  if (xForwardedFor) {
    const ip = extractFirstIp(xForwardedFor);
    // For ngrok, x-forwarded-for contains the real client IP
    // Return it even if it looks like localhost (ngrok might pass through localhost)
    if (ip) {
      // console.log("[utils] ✅ Extracted IP from x-forwarded-for:", ip, "(raw header:", xForwardedFor + ")");
      return ip;
    }
  } else {
    console.log("[utils] ⚠️ No x-forwarded-for header found");
  }

  // Priority 2: x-real-ip
  const xRealIp = getHeaderValue("x-real-ip");
  if (xRealIp) {
    const ip = extractFirstIp(xRealIp);
    if (ip && ip !== "::1") {
      return ip;
    }
  }

  // Priority 3: cf-connecting-ip (Cloudflare)
  const cfConnectingIp = getHeaderValue("cf-connecting-ip");
  if (cfConnectingIp) {
    const ip = extractFirstIp(cfConnectingIp);
    if (ip && ip !== "::1") {
      return ip;
    }
  }

  // Priority 4: true-client-ip (some proxies)
  const trueClientIp = getHeaderValue("true-client-ip");
  if (trueClientIp) {
    const ip = extractFirstIp(trueClientIp);
    if (ip && ip !== "::1") {
      return ip;
    }
  }

  // Priority 5: req.ip (Express/Fastify) - but skip if it's ::1
  if (req.ip && req.ip !== "::1" && req.ip !== "127.0.0.1") {
    return req.ip;
  }

  // Priority 6: socket remoteAddress - but skip if it's ::1 or localhost
  if (req.socket && req.socket.remoteAddress) {
    const ip = req.socket.remoteAddress;
    if (ip !== "::1" && ip !== "127.0.0.1" && !ip.startsWith("192.168.") && !ip.startsWith("10.")) {
      return ip;
    }
  }

  if (req.connection && req.connection.remoteAddress) {
    const ip = req.connection.remoteAddress;
    if (ip !== "::1" && ip !== "127.0.0.1" && !ip.startsWith("192.168.") && !ip.startsWith("10.")) {
      return ip;
    }
  }

  // Debug: Log ALL headers and IP sources
  // console.log("[utils] 🔍 IP extraction debug - ALL headers:", req.headers ? Object.keys(req.headers).reduce((acc, key) => {
  //   acc[key] = req.headers[key];
  //   return acc;
  // }, {}) : "No headers object");
  
  // console.log("[utils] 🔍 IP extraction debug - all sources:", {
  //   "x-forwarded-for": getHeaderValue("x-forwarded-for"),
  //   "x-real-ip": getHeaderValue("x-real-ip"),
  //   "cf-connecting-ip": getHeaderValue("cf-connecting-ip"),
  //   "true-client-ip": getHeaderValue("true-client-ip"),
  //   "req.ip": req.ip,
  //   "req.socket.remoteAddress": req.socket?.remoteAddress,
  //   "req.connection.remoteAddress": req.connection?.remoteAddress,
  //   "req.headers type": req.headers ? typeof req.headers : "no headers",
  //   "req.headers.get type": req.headers && typeof req.headers.get === "function" ? "function" : "not a function",
  // });

  // Fallback
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
