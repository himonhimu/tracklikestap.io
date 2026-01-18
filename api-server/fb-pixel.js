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
  if (req && typeof req.headers.get === "function") {
    // Next.js Request object
    return req.headers.get(headerName);
  }
  if (req && req.headers) {
    // Standard headers object
    const header = req.headers[headerName] || 
                   req.headers[headerName.toLowerCase()] ||
                   req.headers[headerName.toUpperCase()];
    return Array.isArray(header) ? header[0] : header;
  }
  return null;
}

/**
 * Get host from request
 */
function getHost(req) {
  if (req && typeof req.headers.get === "function") {
    return req.headers.get("host");
  }
  if (req && req.headers) {
    return req.headers.host || req.headers.Host || req.headers["host"];
  }
  return null;
}

/**
 * Hash a string using SHA256 (for PII hashing)
 * Facebook requires hashed email/phone for better matching
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
 * Works with both Express req.cookies and cookie header string
 */
function getFbpFromCookies(req) {
  try {
    // Try Express req.cookies first (if using cookie-parser middleware)
    if (req && req.cookies && req.cookies._fbp) {
      return req.cookies._fbp;
    }
    
    // Fallback to parsing cookie header
    const cookies = getHeader(req, "cookie");
    if (!cookies) return null;
    
    const match = cookies.match(/_fbp=([^;]+)/);
    return match ? match[1] : null;
  } catch (err) {
    return null;
  }
}

/**
 * Extract Facebook Click ID (_fbc) from cookies
 * Works with both Express req.cookies and cookie header string
 */
function getFbcFromCookies(req) {
  try {
    // Try Express req.cookies first (if using cookie-parser middleware)
    if (req && req.cookies && req.cookies._fbc) {
      return req.cookies._fbc;
    }
    
    // Fallback to parsing cookie header
    const cookies = getHeader(req, "cookie");
    if (!cookies) return null;
    
    const match = cookies.match(/_fbc=([^;]+)/);
    return match ? match[1] : null;
  } catch (err) {
    return null;
  }
}

export async function sendFbEvent(eventData, req) {
  const PIXEL_ID = req.body.pixel_id;
  const ACCESS_TOKEN = req.body.token;
  const TEST_EVENT_CODE = req.body.test_code;

  delete req.body.pixel_id;
  delete req.body.token;
  delete req.body.test_code;

  try {
    // Extract client IP and user agent from request
    const clientIp =
      getHeader(req, "x-forwarded-for")?.split(",")[0]?.trim() ||
      getHeader(req, "x-real-ip")?.trim() ||
      getHeader(req, "cf-connecting-ip")?.trim() ||
      "0.0.0.0";
    const userAgent = getHeader(req, "user-agent") || "";

    // Get event time (must be within 7 days)
    const eventTime = eventData.ts
      ? Math.floor(eventData.ts / 1000)
      : Math.floor(Date.now() / 1000);

    // Determine event name (default to PageView)
    const eventName = eventData.event || "PageView";

    // Build custom_data based on event type
    let customData = {
      content_name: eventData.path || "Unknown",
    };

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
    } else if (eventName === "Purchase" && eventData.products) {
      const totalValue =
        eventData.value ||
        eventData.products.reduce(
          (sum, p) => sum + parseFloat(p.price) * (parseInt(p.quantity) || 1),
          0
        );
      customData = {
        content_name: "Purchase",
        content_ids: eventData.products.map((p) => String(p.id)),
        content_type: "product",
        contents: eventData.products.map((p) => ({
          id: String(p.id),
          quantity: parseInt(p.quantity) || 1,
          item_price: parseFloat(p.price),
        })),
        value: parseFloat(totalValue),
        currency: eventData.currency || "USD",
        num_items: eventData.products.reduce(
          (sum, p) => sum + (parseInt(p.quantity) || 1),
          0
        ),
      };
    }

    // Build event source URL
    // Priority: 1. eventData.url (full URL from frontend), 2. origin/referer header, 3. host + path
    let eventSourceUrl = "";
    
    // Option 1: Use full URL if provided in eventData
    if (eventData.url && (eventData.url.startsWith("http://") || eventData.url.startsWith("https://"))) {
      eventSourceUrl = eventData.url;
    }
    // Option 2: Use origin header (frontend URL)
    else if (getHeader(req, "origin")) {
      const origin = getHeader(req, "origin");
      if (eventData.path) {
        eventSourceUrl = `${origin}${eventData.path.startsWith("/") ? eventData.path : "/" + eventData.path}`;
      } else {
        eventSourceUrl = origin;
      }
    }
    // Option 3: Use referer header (frontend URL)
    else if (getHeader(req, "referer") || getHeader(req, "referrer")) {
      const referer = getHeader(req, "referer") || getHeader(req, "referrer");
      if (eventData.path) {
        // Extract base URL from referer and append path
        try {
          const refererUrl = new URL(referer);
          eventSourceUrl = `${refererUrl.origin}${eventData.path.startsWith("/") ? eventData.path : "/" + eventData.path}`;
        } catch (e) {
          eventSourceUrl = referer;
        }
      } else {
        eventSourceUrl = referer;
      }
    }
    // Option 4: Use environment variable for frontend URL
    else if (process.env.FRONTEND_URL) {
      const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, ""); // Remove trailing slash
      if (eventData.path) {
        eventSourceUrl = `${frontendUrl}${eventData.path.startsWith("/") ? eventData.path : "/" + eventData.path}`;
      } else {
        eventSourceUrl = frontendUrl;
      }
    }
    // Option 5: Fallback to host + path (API server host - not ideal)
    else {
      const host = getHost(req);
      const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
      
      if (eventData.path) {
        if (eventData.path.startsWith("http://") || eventData.path.startsWith("https://")) {
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

    // Build user_data with enhanced matching
    const userData = {
      client_ip_address: clientIp,
      client_user_agent: userAgent,
    };

    // Add Facebook Browser ID (_fbp) if available (improves matching)
    const fbp = getFbpFromCookies(req);
    if (fbp) {
      userData.fbp = fbp;
    }

    // Add Facebook Click ID (_fbc) if available
    const fbc = getFbcFromCookies(req);
    if (fbc) {
      userData.fbc = fbc;
    }

    // Debug: Log cookie info
    const cookieHeader = getHeader(req, "cookie");
    if (cookieHeader) {
      const hasFbp = cookieHeader.includes("_fbp");
      const hasFbc = cookieHeader.includes("_fbc");
      if (!hasFbp && !hasFbc) {
        // console.log("[fb-pixel] No _fbp or _fbc cookies found. Cookie header:", cookieHeader.substring(0, 200));
      }
    } else {
      console.log("[fb-pixel] No cookie header found in request");
    }

    // Add hashed email/phone if provided in eventData
    if (eventData.email) {
      const hashedEmail = hashString(eventData.email);
      if (hashedEmail) {
        userData.em = hashedEmail;
      }
    }

    if (eventData.phone) {
      const hashedPhone = hashString(eventData.phone);
      if (hashedPhone) {
        userData.ph = hashedPhone;
      }
    }

    // Build Facebook Conversions API payload
    const eventPayload = {
      event_name: eventName,
      event_time: eventTime,
      event_source_url: eventSourceUrl,
      action_source: "website",
      user_data: userData,
      custom_data: customData,
    };

// console.log("[fb-pixel] Event Payload:", JSON.stringify(eventPayload, null, 2));
  

    // Add event_id for deduplication if provided
    if (eventData.event_id) {
      eventPayload.event_id = eventData.event_id;
    }

    if (!ACCESS_TOKEN) {
      console.error("[fb-pixel] Missing access token");
      return null;
    }

    const payload = {
      data: [eventPayload],
      access_token: ACCESS_TOKEN,
    };
    // console.log("[fb-pixel] Payload:", JSON.stringify(eventPayload, null, 2));

    // Build API URL with optional test event code
    let apiUrl = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;
    if (TEST_EVENT_CODE) {
      apiUrl += `?test_event_code=${TEST_EVENT_CODE}`;
    }

    // console.log("[fb-pixel] Sending event:", {
    //   event_name: eventName,
    //   event_time: eventTime,
    //   event_source_url: eventSourceUrl,
    //   has_fbp: !!fbp,
    //   has_fbc: !!fbc,
    //   has_test_code: !!TEST_EVENT_CODE,
    //   custom_data: customData,
    //   user_data_keys: Object.keys(userData),
    // });

    // Send to Facebook Conversions API
    // console.log("[fb-pixel] Sending event to Facebook:", payload);
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

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
    
    // Log detailed response for debugging
    // console.log("[fb-pixel] Facebook API Response:", {
    //   events_received: result.events_received,
    //   messages: result.messages || [],
    //   fbtrace_id: result.fbtrace_id,
    //   has_warnings: result.messages && result.messages.length > 0,
    // });
    
    if (result.messages && result.messages.length > 0) {
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
      console.log(`[fb-pixel] ✅ Successfully sent ${result.events_received} event(s) to Facebook`);
    }
    // console.log("[fb-pixel] Result:", JSON.stringify(result, null, 2));
    
    return result;
  } catch (err) {
    console.error("[fb-pixel] Failed to send event:", err);
    return null;
  }
}
