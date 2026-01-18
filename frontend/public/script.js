/**
 * Auto-tracking script for page views
 * Automatically tracks page views and SPA navigation
 */

(function () {
  if (typeof window === "undefined") return;

  // Generate unique event ID (UUID v4)
  function generateEventId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    // Fallback UUID generation
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function createPayload() {
    return {
      path: location.pathname,
      url: location.href, // Send full URL
      referrer: document.referrer || null,
      ua: navigator.userAgent,
      ts: Date.now(),
      event: "PageView",
    };
  }

  // Determine API URL (don't use process.env in browser bundle)
  function getApiUrl() {
    if (typeof window === "undefined") {
      throw new Error("getApiUrl() can only be called in browser environment");
    }
    
    // Try global/window variable (injected at runtime)
    if (window.NEXT_PUBLIC_API_URL) {
      return window.NEXT_PUBLIC_API_URL.replace(/\/+$/, "") + "/event";
    }

    // Also allow <meta name="next-public-api-url" ...>
    var meta = document.querySelector('meta[name="next-public-api-url"]');
    if (meta && meta.content) {
      return meta.content.replace(/\/+$/, "") + "/event";
    }
    
    // If neither is available, throw error
    throw new Error("NEXT_PUBLIC_API_URL is not set. Please set it as a window variable or meta tag.");
  }

  async function sendPageView() {
    try {
      const data = createPayload();
      
      // Generate unique event ID for deduplication
      const eventId = generateEventId();
      data.event_id = eventId;

      // Send to Facebook Pixel with event_id (if available)
      // console.log("[analytics] Sending page view to Facebook Pixel:", window.fbq);
      if (window.fbq) {
        // console.log("[analytics] Sending page view to Facebook Pixel:", window.fbq);
        window.fbq("track", "PageView", {}, { eventID: eventId });
      }

      // Send to Next.js API
      // Server will handle: MySQL storage + Facebook Conversions API (server-side tracking)
      const apiUrl = getApiUrl();

      // console.log("[analytics] Sending page view to:", apiUrl);

      await fetch(apiUrl, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Include cookies for _fbp and _fbc
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.error("[analytics] Failed to send page view:", err);
    }
  }

  // Track initial page load
  sendPageView();

  // Track SPA navigation (Next.js App Router)
  // Intercept pushState and popstate for client-side navigation
  const originalPushState = history.pushState;
  history.pushState = function () {
    originalPushState.apply(history, arguments);
    // Small delay to ensure route has updated
    setTimeout(sendPageView, 100);
  };

  window.addEventListener("popstate", () => {
    setTimeout(sendPageView, 100);
  });

  // Also listen for Next.js route changes if available
  if (typeof window.next !== "undefined") {
    // Next.js router events (if using Pages Router)
    window.addEventListener("routeChangeComplete", sendPageView);
  }
})();
