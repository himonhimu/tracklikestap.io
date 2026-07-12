/**
 * Normalize a host or URL to a stable site_key for event_counts.
 * e.g. "https://www.example.com/path" -> "example.com"
 */
export function normalizeSiteKey(hostOrUrl) {
  if (hostOrUrl == null || !String(hostOrUrl).trim()) return null;
  let s = String(hostOrUrl).trim();
  try {
    if (/^https?:\/\//i.test(s)) {
      s = new URL(s).hostname || s;
    }
  } catch {
    // keep raw
  }
  s = s.replace(/^https?:\/\//i, "");
  s = s.split("/")[0].split("?")[0].split("#")[0];
  s = s.replace(/^www\./i, "");
  s = s.replace(/:\d+$/, "");
  s = s.toLowerCase();
  return s || null;
}

/**
 * Prefer page URL host, then request host.
 */
export function siteKeyFromEvent(event) {
  try {
    if (event?.full_url) {
      const key = normalizeSiteKey(new URL(event.full_url).hostname);
      if (key) return key;
    }
  } catch {
    // fall through
  }
  return normalizeSiteKey(event?.host) || "unknown";
}
