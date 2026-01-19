/**
 * Facebook Conversions API - Server-side tracking
 * Similar to Stape.io server-side tracking
 * Framework-agnostic implementation
 */

import { createHash } from 'crypto';

/**
 * Extract headers from request (works with Next.js Request or standard request objects)
 */
function getHeader(req, headerName) {
  // For Fetch API or Next.js Request object
  if (req && typeof req.headers?.get === "function") {
    return req.headers.get(headerName);
  }
  // For Node.js/Express.js headers object (object, lower/upper/mixed case)
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
    return req.headers.host ||
           req.headers.Host ||
           req.headers["host"];
  }
  return null;
}

/**
 * Hash a string using SHA256 (used for PII hashing)
 */
function hashString(str) {
  if (!str) return null;
  try {
    const hash = createHash('sha256');
    hash.update(str.toLowerCase().trim());
    return hash.digest('hex');
  } catch (err) {
    console.warn("[fb-pixel] Failed to hash string:", err);
    return null;
  }
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
  const slug = eventData.path.split("/").pop();
  // console.log("slug", slug);

  let fbCredentials = null;
  try {
    const productRes = await fetch(
      `${process.env.EXTERNAL_API}/products/get-fb-credentials/${slug}`
    );
    fbCredentials = await productRes.json();
  } catch {
    fbCredentials = null;
  }

  const PIXEL_ID = fbCredentials?.pixel_id;
  const ACCESS_TOKEN = fbCredentials?.token;
  const TEST_EVENT_CODE = fbCredentials?.test_code;

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
      content_name: eventData.path || "Unknown",
    };

    // ADD TO CART
    if (eventName === "AddToCart" && eventData.product) {
      customData = {
        content_name: eventData.product.name,
        content_ids: [String(eventData.product.id)],
        content_type: "product",
        contents: [
          {
            id: String(eventData.product.id),
            quantity: 1,
            item_price: parseFloat(eventData.product.price),
          },
        ],
        value: parseFloat(eventData.product.price),
        currency: eventData.product.currency || "USD",
      };
    }
    // PURCHASE - match the shape actually sent from client, fix currency handling
    else if (eventName === "Purchase" && (eventData.products || eventData.product)) {
      // Accept both array and single product
      const currency = eventData.currency ||
        (eventData.product?.currency || (eventData.products?.[0]?.currency)) ||
        "BDT"; // Default to BDT since you want that, fallback to USD if not provided

      let contents = [];
      let content_ids = [];
      let num_items = 0;
      let value = 0;

      // If "products" is sent (array)
      if (Array.isArray(eventData.products) && eventData.products.length > 0) {
        contents = eventData.products.map((p) => ({
          id: String(p.id),
          quantity: parseInt(p.quantity) || 1,
          item_price: parseFloat(p.price),
        }));
        content_ids = eventData.products.map((p) => String(p.id));
        num_items = eventData.products.reduce(
          (sum, p) => sum + (parseInt(p.quantity) || 1),
          0
        );
        value =
          eventData.value ??
          eventData.products.reduce(
            (sum, p) => sum + parseFloat(p.price) * (parseInt(p.quantity) || 1),
            0
          );
      } else if (eventData.product) {
        // If only a single product key sent
        const p = eventData.product;
        contents = [
          {
            id: String(p.id),
            quantity: 1,
            item_price: parseFloat(p.price),
          },
        ];
        content_ids = [String(p.id)];
        num_items = 1;
        value = eventData.value ?? parseFloat(p.price);
      }

      customData = {
        content_name: "Purchase",
        content_ids,
        content_type: "product",
        contents,
        value: parseFloat(value),
        currency,
        num_items,
      };
    }

    // Construct eventSourceUrl from most reliable to fallback
    let eventSourceUrl = "";
    if (
      eventData.url &&
      (eventData.url.startsWith("http://") || eventData.url.startsWith("https://"))
    ) {
      eventSourceUrl = eventData.url;
    } else if (getHeader(req, "origin")) {
      const origin = getHeader(req, "origin");
      eventSourceUrl = eventData.path
        ? `${origin}${eventData.path.startsWith("/") ? eventData.path : "/" + eventData.path}`
        : origin;
    } else if (getHeader(req, "referer") || getHeader(req, "referrer")) {
      const referer = getHeader(req, "referer") || getHeader(req, "referrer");
      if (eventData.path) {
        try {
          const refererUrl = new URL(referer);
          eventSourceUrl = `${refererUrl.origin}${
            eventData.path.startsWith("/") ? eventData.path : "/" + eventData.path
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
        ? `${frontendUrl}${eventData.path.startsWith("/") ? eventData.path : "/" + eventData.path}`
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
          eventSourceUrl = `${protocol}://${host}${eventData.path.startsWith("/") ? eventData.path : "/" + eventData.path}`;
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
    if (eventData.email) {
      const hashedEmail = hashString(eventData.email);
      if (hashedEmail) userData.em = hashedEmail;
    }
    if (eventData.phone) {
      const hashedPhone = hashString(eventData.phone);
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

    if (payload?.data?.[0]?.event_name === "Purchase") {
      console.log(payload.data);
    }

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
      console.warn("[fb-pixel] ⚠️ Facebook received 0 events. Check payload structure.");
      console.log("[fb-pixel] Full payload sent:", JSON.stringify(payload, null, 2));
    } else {
      // console.log(`[fb-pixel] ✅ Successfully sent ${result.events_received} event(s) to Facebook`);
    }

    return result;
  } catch (err) {
    console.error("[fb-pixel] Failed to send event:", err);
    return null;
  }
}
