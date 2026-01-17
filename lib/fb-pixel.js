/**
 * Facebook Conversions API - Server-side tracking
 * Similar to Stape.io server-side tracking
 */

export async function sendFbEvent(eventData, req) {
  const PIXEL_ID =
    process.env.NEXT_PUBLIC_FB_PIXEL_ID || process.env.FB_PIXEL_ID;
  const ACCESS_TOKEN = process.env.NEXT_PUBLIC_FB_ACCESS_TOKEN;
  const TEST_EVENT_CODE = process.env.NEXT_PUBLIC_FB_TEST_EVENT_CODE || process.env.FB_TEST_EVENT_CODE;

  // console.log(PIXEL_ID, ACCESS_TOKEN);

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return null; // Skip if not configured
  }

  try {
    // Extract client IP and user agent from request
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "0.0.0.0";
    const userAgent = req.headers.get("user-agent") || "";

    // Get event time
    const eventTime = eventData.ts
      ? Math.floor(eventData.ts / 1000)
      : Math.floor(Date.now() / 1000);

    // Determine event name (default to PageView)
    const eventName = eventData.event || "PageView";

    // Build custom_data based on event type
    let customData = {
      content_name: eventData.path,
    };

    if (eventName === "AddToCart" && eventData.product) {
      customData = {
        content_name: eventData.product.name,
        content_ids: [eventData.product.id],
        content_type: "product",
        contents: [
          {
            id: eventData.product.id,
            quantity: 1,
            item_price: eventData.product.price,
          },
        ],
        value: eventData.product.price,
        currency: eventData.product.currency || "USD",
      };
    } else if (eventName === "Purchase" && eventData.products) {
      const totalValue =
        eventData.value ||
        eventData.products.reduce(
          (sum, p) => sum + p.price * (p.quantity || 1),
          0
        );
      customData = {
        content_name: "Purchase",
        content_ids: eventData.products.map((p) => p.id),
        content_type: "product",
        contents: eventData.products.map((p) => ({
          id: p.id,
          quantity: p.quantity || 1,
          item_price: p.price,
        })),
        value: totalValue,
        currency: eventData.currency || "USD",
        num_items: eventData.products.reduce(
          (sum, p) => sum + (p.quantity || 1),
          0
        ),
      };
    }

    // Build Facebook Conversions API payload
    const eventPayload = {
      event_name: eventName,
      event_time: eventTime,
      event_source_url: `http://${req.headers.get("host")}${
        eventData.path
      }`,
      action_source: "website",
      user_data: {
        client_ip_address: clientIp,
        client_user_agent: userAgent,
      },
      custom_data: customData,
    };

    // Add event_id for deduplication if provided
    if (eventData.event_id) {
      eventPayload.event_id = eventData.event_id;
    }

    const payload = {
      data: [eventPayload],
      access_token: ACCESS_TOKEN,
    };

    // Build API URL with optional test event code
    let apiUrl = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;
    if (TEST_EVENT_CODE) {
      apiUrl += `?test_event_code=${TEST_EVENT_CODE}`;
    }

    // Send to Facebook Conversions API
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
    // const result = await response.json();
    // console.log("[fb-pixel] Event sent successfully:", result);
    return result;
  } catch (err) {
    console.error("[fb-pixel] Failed to send event:", err);
    return null;
  }
}
