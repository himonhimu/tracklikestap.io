/**
 * API client for api-server-v2 analytics and auth.
 * Base URL: use Vite proxy in dev (leave empty) or set VITE_API_URL for production.
 * Token: read from localStorage key 'dashboard_token'; add to requests when present.
 */
const BASE = import.meta.env.VITE_API_URL || "";

function getToken() {
  return typeof window !== "undefined"
    ? localStorage.getItem("dashboard_token")
    : null;
}

function buildQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") q.set(k, v);
  });
  const s = q.toString();
  return s ? "?" + s : "";
}

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const headers = { "Content-Type": "application/json", ...options.headers };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem("dashboard_token");
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(res.statusText || "API error");
    err.status = res.status;
    try {
      err.body = await res.json();
    } catch {
      err.body = await res.text();
    }
    throw err;
  }
  return res.json();
}

export const api = {
  health: () => request("/health"),
  login: (email, password) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  getMe: () => request("/api/auth/me"),
  getUsers: () => request("/api/auth/users"),
  getUser: (id) => request(`/api/auth/users/${id}`),
  updateUser: (id, body) =>
    request(`/api/auth/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getTotalUsers: (urlContains, userId) =>
    request(
      "/api/analytics/users/total" +
        buildQuery({ url_contains: urlContains, user_id: userId }),
    ),
  getUsersByDevice: (urlContains, userId) =>
    request(
      "/api/analytics/users/by-device" +
        buildQuery({ url_contains: urlContains, user_id: userId }),
    ),
  getUsersByLocation: (urlContains, userId) =>
    request(
      "/api/analytics/users/by-location" +
        buildQuery({ url_contains: urlContains, user_id: userId }),
    ),
  getRecentUsers: (limit = 50, urlContains, userId) =>
    request(
      "/api/analytics/users/recent" +
        buildQuery({ limit, url_contains: urlContains, user_id: userId }),
    ),
  getEventCounts: (urlContains, userId) =>
    request(
      "/api/analytics/events/counts" +
        buildQuery({ url_contains: urlContains, user_id: userId }),
    ),
  getPurchases: (limit = 50, urlContains, userId) =>
    request(
      "/api/analytics/events/purchases" +
        buildQuery({ limit, url_contains: urlContains, user_id: userId }),
    ),
  getAddToCart: (limit = 50, urlContains, userId) =>
    request(
      "/api/analytics/events/add-to-cart" +
        buildQuery({ limit, url_contains: urlContains, user_id: userId }),
    ),
  getEventsByType: (
    eventType,
    limit = 50,
    urlContains,
    userId,
    dateFrom,
    dateTo,
    referral,
  ) =>
    request(
      `/api/analytics/events/${encodeURIComponent(eventType)}` +
        buildQuery({
          limit,
          url_contains: urlContains,
          user_id: userId,
          ...(dateFrom && dateTo
            ? { date_from: dateFrom, date_to: dateTo }
            : {}),
          ...(referral && referral !== "All" ? { referral } : {}),
        }),
    ),
  getEventsByTime: (
    eventType,
    granularity = "daily",
    urlContains,
    days,
    dateFrom,
    dateTo,
    userId,
  ) =>
    request(
      `/api/analytics/events/${encodeURIComponent(eventType)}/by-time` +
        buildQuery({
          granularity,
          url_contains: urlContains,
          user_id: userId,
          ...(days != null ? { days } : {}),
          ...(dateFrom && dateTo
            ? { date_from: dateFrom, date_to: dateTo }
            : {}),
        }),
    ),
  getArchives: () => request("/api/analytics/archives"),
  getReferrals: (urlContains, userId, days = 30, dateFrom, dateTo) =>
    request(
      "/api/analytics/referrals" +
        buildQuery({
          url_contains: urlContains,
          user_id: userId,
          ...(dateFrom && dateTo
            ? { date_from: dateFrom, date_to: dateTo }
            : { days: days === 0 ? "all" : days }),
        }),
    ),
  getEventsByIp: (ip, userId, siteUrl) =>
    request(
      "/api/analytics/events/by-ip/grouped" +
        buildQuery({ ip, user_id: userId, site_url: siteUrl }),
    ),
  /** One request for event-type counts across many IPs (Users page). */
  getEventStatsByIps: (ips, userId, siteUrl) =>
    request(
      "/api/analytics/events/stats-by-ips" +
        buildQuery({
          ips: Array.isArray(ips) ? ips.join(",") : ips,
          user_id: userId,
          site_url: siteUrl,
        }),
    ),
};
