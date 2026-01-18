/**
 * Client-side analytics utility
 * Handles sending events to the API server
 */

/**
 * Generate a unique event ID (UUID v4)
 */
export function generateEventId() {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback UUID generation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get API endpoint URL
 * Uses window variable (injected by layout) or process.env
 */
function getApiUrl() {
  if (typeof window === "undefined") {
    throw new Error("getApiUrl() can only be called in browser environment");
  }
  
  // Priority 1: Use window variable (injected by layout.js)
  if (window.NEXT_PUBLIC_API_URL) {
    const baseUrl = window.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
    return `${baseUrl}/event`;
  }
  
  // Priority 2: Use meta tag (injected by layout.js)
  const meta = document.querySelector('meta[name="next-public-api-url"]');
  if (meta && meta.content) {
    const baseUrl = meta.content.replace(/\/+$/, "");
    return `${baseUrl}/event`;
  }
  
  // Priority 3: Use process.env (Next.js environment variable)
  if (process.env.NEXT_PUBLIC_API_URL) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
    return `${baseUrl}/event`;
  }
  
  // Fallback: Error if not set
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. Please set it in your .env.local file as NEXT_PUBLIC_API_URL=http://localhost:3001"
  );
}

/**
 * Send analytics event to the server
 * @param {string} eventName - Event type (PageView, AddToCart, Purchase)
 * @param {Object} eventData - Event data (product, products, value, currency, etc.)
 * @returns {Promise<Object>} Response from server
 */
export async function trackEvent(eventName, eventData = {}) {
  try {
    const eventId = generateEventId();
    
    const payload = {
      event: eventName,
      path: typeof window !== "undefined" ? window.location.pathname : null,
      url: typeof window !== "undefined" ? window.location.href : null,
      referrer: typeof window !== "undefined" ? document.referrer || null : null,
      ua: typeof window !== "undefined" ? navigator.userAgent : null,
      ts: Date.now(),
      event_id: eventId,
      ...eventData,
    };

    const response = await fetch(getApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // Include cookies for _fbp and _fbc
      body: JSON.stringify(payload),
      keepalive: true, // Keep request alive even if page unloads
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error("[analytics] Failed to send event:", err);
    throw err;
  }
}

/**
 * Track page view
 */
export async function trackPageView() {
  return trackEvent("PageView", {});
}

/**
 * Track add to cart event
 * @param {Object} product - Product object with id, name, price, currency
 */
export async function trackAddToCart(product) {
  if (!product) {
    console.warn("[analytics] trackAddToCart: product is required");
    return;
  }

  return trackEvent("AddToCart", {
    product: {
      id: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency || "USD",
      category: product.category,
    },
  });
}

/**
 * Track purchase event
 * @param {Array} products - Array of product objects
 * @param {number} value - Total purchase value
 * @param {string} currency - Currency code
 */
export async function trackPurchase(products, value, currency = "USD") {
  if (!products || !Array.isArray(products) || products.length === 0) {
    console.warn("[analytics] trackPurchase: products array is required"); 
    return;
  }

  return trackEvent("Purchase", {
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      quantity: p.quantity || 1,
      category: p.category,
    })),
    value: value || products.reduce((sum, p) => sum + p.price * (p.quantity || 1), 0),
    currency,
  });
}
