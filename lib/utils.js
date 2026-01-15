/**
 * Utility functions for analytics
 */

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
 * Get geolocation from IP address using ipapi.co (free tier)
 * You can also use other services like ip-api.com, ipgeolocation.io, etc.
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

  try {
    // Using ipapi.co free tier (1000 requests/day)
    // Alternative: ip-api.com (45 requests/minute)
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
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

    return {
      country: data.country_name || null,
      region: data.region || data.region_code || null,
      city: data.city || null,
      district: data.district || data.postal || null, // Some APIs don't have district
      latitude: data.latitude || null,
      longitude: data.longitude || null,
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
