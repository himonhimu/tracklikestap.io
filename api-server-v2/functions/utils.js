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
 * Extract real client IP address from request, prioritizing Cloudflare headers.
 * 
 * Notes for Cloudflare:
 * - Cloudflare sets the `cf-connecting-ip` header as the client's real IP.
 * - After that, trust x-forwarded-for, then x-real-ip.
 * - For reference: https://developers.cloudflare.com/fundamentals/reference/http-request-headers/#cf-connecting-ip
 */
export function getClientIp(req) {
  if (!req) {
    return "0.0.0.0";
  }

  // Helper to extract first IP from a header value
  const extractFirstIp = (value) => {
    if (!value) return null;
    const str = Array.isArray(value) ? value[0] : value;
    return str.split(",")[0].trim();
  };

  // Helper to get header value, case-insensitive, and works with Next.js or Express
  const getHeaderValue = (headerName) => {
    if (!req || !req.headers) {
      return null;
    }
    // Next.js Request object (Headers instance)
    if (typeof req.headers.get === "function") {
      const value = req.headers.get(headerName) || req.headers.get(headerName.toLowerCase());
      if (value) return value;
    }
    // Express/Fastify headers object (case-insensitive)
    const headers = req.headers;
    const lowerName = headerName.toLowerCase();
    if (headers[headerName]) return headers[headerName];
    if (headers[lowerName]) return headers[lowerName];
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === lowerName) {
        return headers[key];
      }
    }
    return null;
  };

  // 1. Cloudflare: Use cf-connecting-ip header first (most reliable behind Cloudflare)
  const cfConnectingIp = getHeaderValue("cf-connecting-ip");
  if (cfConnectingIp) {
    const ip = extractFirstIp(cfConnectingIp);
    if (ip && ip !== "::1") {
      return ip;
    }
  }

  // 2. Fallback: x-forwarded-for (first in x-forwarded-for can be actual client IP, but Cloudflare sets cf-connecting-ip)
  const xForwardedFor = getHeaderValue("x-forwarded-for");
  if (xForwardedFor) {
    const ip = extractFirstIp(xForwardedFor);
    if (ip && ip !== "::1") {
      return ip;
    }
  }

  // 3. Fallback: x-real-ip
  const xRealIp = getHeaderValue("x-real-ip");
  if (xRealIp) {
    const ip = extractFirstIp(xRealIp);
    if (ip && ip !== "::1") {
      return ip;
    }
  }

  // 4. Fallback: true-client-ip
  const trueClientIp = getHeaderValue("true-client-ip");
  if (trueClientIp) {
    const ip = extractFirstIp(trueClientIp);
    if (ip && ip !== "::1") {
      return ip;
    }
  }

  // 5. Express/Fastify's req.ip field, but can be unreliable behind proxies
  if (req.ip && req.ip !== "::1" && req.ip !== "127.0.0.1") {
    return req.ip;
  }

  // 6. socket remoteAddress (very often proxy IP, not client, but fallback)
  if (req.socket && req.socket.remoteAddress) {
    const ip = req.socket.remoteAddress;
    if (
      ip !== "::1" &&
      ip !== "127.0.0.1" &&
      !ip.startsWith("192.168.") &&
      !ip.startsWith("10.") &&
      !ip.startsWith("172.")
    ) {
      return ip;
    }
  }

  if (req.connection && req.connection.remoteAddress) {
    const ip = req.connection.remoteAddress;
    if (
      ip !== "::1" &&
      ip !== "127.0.0.1" &&
      !ip.startsWith("192.168.") &&
      !ip.startsWith("10.") &&
      !ip.startsWith("172.")
    ) {
      return ip;
    }
  }

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
      // console.log(response.status, response.statusText);

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
