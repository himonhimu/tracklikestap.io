(function () {
  if (typeof window === "undefined") return;

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

