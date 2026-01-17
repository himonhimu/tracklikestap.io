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

  function payload() {
    return {
      path: location.pathname,
      referrer: document.referrer || null,
      ua: navigator.userAgent,
      ts: Date.now(),
    };
  }

  function send() {
    var data = payload();
    
    // Generate unique event ID for deduplication
    var eventId = generateEventId();
    data.event_id = eventId;

    // Send to Facebook Pixel with event_id (if available)
    if (window.fbq) {
      window.fbq("track", "PageView", {}, { eventID: eventId });
    }

    // Send to Next.js API
    // Server will handle: MySQL storage + Facebook Conversions API (server-side tracking)
    fetch("/api/event", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  send();

  // Track SPA navigation
  var pushState = history.pushState;
  history.pushState = function () {
    pushState.apply(history, arguments);
    send();
  };

  window.addEventListener("popstate", send);
})();

