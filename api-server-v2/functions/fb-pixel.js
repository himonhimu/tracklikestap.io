/**
 * Facebook Conversions API - Server-side tracking
 * Implements Facebook's Parameter Builder for improved Click ID (fbc) parameter coverage
 * Framework-agnostic implementation
 *
 * See: https://developers.facebook.com/docs/marketing-api/conversions-api/using-the-api/parameter-builder
 */

import { createHash } from "crypto";

/**
 * Extract headers from request (works with Next.js Request or standard request objects)
 */
function getHeader(req, headerName) {
  if (req && typeof req.headers?.get === "function") {
    return req.headers.get(headerName);
  }
  if (req && req.headers) {
    const h =
      req.headers[headerName] ??
      req.headers[headerName.toLowerCase()] ??
      req.headers[headerName.toUpperCase()];
    return Array.isArray(h) ? h[0] : h;
  }
  return null;
}

/**
 * Get host from request object
 */
function getHost(req) {
  // For Fetch API or Next.js Request object
  if (req && typeof req.headers?.get === "function") {
    return req.headers.get("host");
  }
  // For Node.js/Express.js headers object
  if (req && req.headers) {
    return req.headers.host || req.headers.Host || req.headers["host"];
  }
  return null;
}

/**
 * Hash a string using SHA256 (used for PII hashing)
 */
function hashString(str) {
  if (!str) return null;
  try {
    const hash = createHash("sha256");
    hash.update(str.toLowerCase().trim());
    return hash.digest("hex");
  } catch (err) {
    console.warn("[fb-pixel] Failed to hash string:", err);
    return null;
  }
}

/**
 * Generate a random email address for fallback.
 */
function getRandomEmail() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let user = "";
  for (let i = 0; i < 10; i++) {
    user += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${user}@example.com`;
}

/**
 * Generate a random phone number for fallback.
 */
function getRandomPhone() {
  // Example random Bangladeshi number: +8801XXXXXXXXX
  const prefix = "+8801";
  let num = "";
  for (let i = 0; i < 9; i++) {
    num += Math.floor(Math.random() * 10);
  }
  return `${prefix}${num}`;
}

/**
 * Extract Facebook Browser ID (_fbp) from cookies
 */
function getFbpFromCookies(req) {
  try {
    if (req?.cookies?._fbp) return req.cookies._fbp;
    const cookies = getHeader(req, "cookie");
    if (!cookies) return null;
    const match = cookies.match(/_fbp=([^;]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Extract Facebook Click ID (_fbc) from cookies
 */
function getFbcFromCookies(req) {
  try {
    if (req?.cookies?._fbc) return req.cookies._fbc;
    const cookies = getHeader(req, "cookie");
    if (!cookies) return null;
    const match = cookies.match(/_fbc=([^;]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function sendFbEvent(eventData, req) {
  const PIXEL_ID = req?.headers?.f_pixel_id;
  const ACCESS_TOKEN = req?.headers?.f_access_token;
  const TEST_EVENT_CODE = req?.headers?.f_test_event_code;

  try {
    // Prefer forwarded client IP, then real IP, then CF, else fallback
    const clientIp =
      getHeader(req, "x-forwarded-for")?.split(",")[0]?.trim() ||
      getHeader(req, "x-real-ip")?.trim() ||
      getHeader(req, "cf-connecting-ip")?.trim() ||
      "0.0.0.0";
    const userAgent = getHeader(req, "user-agent") || "";

    // Use eventData.ts if present (ms), else now (seconds)
    const eventTime = eventData.ts
      ? Math.floor(eventData.ts / 1000)
      : Math.floor(Date.now() / 1000);

    // Facebook CAPI event name, or fall back to PageView
    const eventName = eventData.event || "PageView";

    // Set up customData for the event type
    let customData = {
      content_name: eventData.content_name | eventData.path || "Unknown",
      content_type: eventData.content_type || "product",
      content_ids: eventData.content_ids || [],
      num_items: eventData.num_items || 1,
      quantity: eventData.quantity || 1,
      value: eventData.value || 0,
      currency: eventData.currency || "BDT",
    };

    // Construct eventSourceUrl from most reliable to fallback
    let eventSourceUrl = "";
    if (
      eventData.url &&
      (eventData.url.startsWith("http://") ||
        eventData.url.startsWith("https://"))
    ) {
      eventSourceUrl = eventData.url;
    } else if (getHeader(req, "origin")) {
      const origin = getHeader(req, "origin");
      eventSourceUrl = eventData.path
        ? `${origin}${
            eventData.path.startsWith("/")
              ? eventData.path
              : "/" + eventData.path
          }`
        : origin;
    } else if (getHeader(req, "referer") || getHeader(req, "referrer")) {
      const referer = getHeader(req, "referer") || getHeader(req, "referrer");
      if (eventData.path) {
        try {
          const refererUrl = new URL(referer);
          eventSourceUrl = `${refererUrl.origin}${
            eventData.path.startsWith("/")
              ? eventData.path
              : "/" + eventData.path
          }`;
        } catch {
          eventSourceUrl = referer;
        }
      } else {
        eventSourceUrl = referer;
      }
    } else if (process.env.FRONTEND_URL) {
      const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, "");
      eventSourceUrl = eventData.path
        ? `${frontendUrl}${
            eventData.path.startsWith("/")
              ? eventData.path
              : "/" + eventData.path
          }`
        : frontendUrl;
    } else {
      const host = getHost(req);
      const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
      if (eventData.path) {
        if (
          eventData.path.startsWith("http://") ||
          eventData.path.startsWith("https://")
        ) {
          eventSourceUrl = eventData.path;
        } else if (host) {
          eventSourceUrl = `${protocol}://${host}${
            eventData.path.startsWith("/")
              ? eventData.path
              : "/" + eventData.path
          }`;
        } else {
          eventSourceUrl = eventData.path;
        }
      } else if (host) {
        eventSourceUrl = `${protocol}://${host}`;
      }
    }

    // Prepare user_data for CAPI
    const userData = {
      client_ip_address: clientIp,
      client_user_agent: userAgent,
      external_id: eventData.external_id,
    };

    // Attach _fbp/_fbc if available
    const fbp = getFbpFromCookies(req);
    if (fbp) userData.fbp = fbp;
    const fbc = getFbcFromCookies(req);
    if (fbc) userData.fbc = fbc;

    // Optionally warn about missing cookies (via debug log)
    const cookieHeader = getHeader(req, "cookie");
    if (!cookieHeader) {
      console.log("[fb-pixel] No cookie header found in request");
    }

    // Optionally provide PII for matching, hashed
    //  console.log("[em, ph]", eventData.email, eventData.phone);

    // Generate random replacements if missing
    let emailToUse = eventData.email;
    let phoneToUse = eventData.phone;

    if (!emailToUse) {
      emailToUse = getRandomEmail();
      emailToUse = hashString(emailToUse);
    }
    if (!phoneToUse) {
      phoneToUse = getRandomPhone();
      phoneToUse = hashString(phoneToUse);
    }

    if (emailToUse) {
      const hashedEmail = emailToUse;
      if (hashedEmail) userData.em = hashedEmail;
    }
    if (phoneToUse) {
      const hashedPhone = phoneToUse;
      if (hashedPhone) userData.ph = hashedPhone;
    }

    // Compose event payload as required by Facebook CAPI
    const eventPayload = {
      event_name: eventName,
      event_time: eventTime,
      event_source_url: eventSourceUrl,
      action_source: "website",
      user_data: userData,
      custom_data: customData,
    };
    // console.log(userData);

    // Optionally attach event_id for deduplication
    if (eventData.event_id) {
      eventPayload.event_id = eventData.event_id;
    }

    const payload = {
      data: [eventPayload],
      access_token: ACCESS_TOKEN,
    };

    let apiUrl = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;
    if (TEST_EVENT_CODE) {
      apiUrl += `?test_event_code=${TEST_EVENT_CODE}`;
    }

    // Ensure we never send invalid/missing tokens
    if (!ACCESS_TOKEN) {
      console.error("[fb-pixel] Missing access token");
      return;
    }
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // if (payload?.data?.[0]?.event_name === "Purchase") {
    //   console.log(payload.data);
    // }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "[fb-pixel] Facebook API error:",
        response.status,
        errorText
      );
      return null;
    }

    const result = await response.json();

    // console.log(result);

    // Print Facebook warnings and result to the console if present
    if (result.messages?.length > 0) {
      console.warn("[fb-pixel] Facebook warnings:", result.messages);
      result.messages.forEach((msg) => {
        if (msg.message) {
          console.warn(`[fb-pixel] Warning: ${msg.message}`);
        }
      });
    }

    if (result.events_received === 0) {
      console.warn(
        "[fb-pixel] ⚠️ Facebook received 0 events. Check payload structure."
      );
      console.log(
        "[fb-pixel] Full payload sent:",
        JSON.stringify(payload, null, 2)
      );
    } else {
      // console.log(`[fb-pixel] ✅ Successfully sent ${result.events_received} event(s) to Facebook`);
    }

    return result;
  } catch (err) {
    console.error("[fb-pixel] Failed to send event:", err);
    return null;
  }
}
