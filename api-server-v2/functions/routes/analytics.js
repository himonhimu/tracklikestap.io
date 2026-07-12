import express from "express";
import {
  getTotalUniqueUsers,
  getUniqueUsersByDevice,
  getUniqueUsersByLocation,
  getEventCounts,
  getPurchaseEvents,
  getAddToCartEvents,
  getEventsByType,
  getEventsByTime,
  getRecentUniqueUsers,
  getEventsByIpGrouped,
  getEventStatsByIps,
  getArchiveMonths,
  clampLimit,
} from "../analytics-queries.js";
import { getReferralCounts } from "../referral-counts.js";

const router = express.Router();

function getUrlFilter(req) {
  return req.effectiveUrlFilter !== undefined
    ? req.effectiveUrlFilter
    : req.query.url_contains || req.query.urlContains || null;
}

function getDaysParam(req, defaultDays = 30) {
  const raw = req.query.days;
  if (raw === undefined || raw === null || raw === "") return defaultDays;
  if (String(raw).toLowerCase() === "all") return 0;
  return raw;
}

/**
 * GET /api/analytics/users/total
 * Query: days (default 30, 0 or "all" = all time)
 */
router.get("/users/total", async (req, res) => {
  try {
    const urlContains = getUrlFilter(req);
    const days = getDaysParam(req, 30);
    const count = await getTotalUniqueUsers(urlContains, days);
    res.json({ count });
  } catch (err) {
    console.error("[api/analytics] Failed to get total users:", err);
    res.status(500).json({ error: "Failed to get total users" });
  }
});

/**
 * GET /api/analytics/users/by-device
 */
router.get("/users/by-device", async (req, res) => {
  try {
    const urlContains = getUrlFilter(req);
    const days = getDaysParam(req, 30);
    const data = await getUniqueUsersByDevice(urlContains, days);
    res.json({ data });
  } catch (err) {
    console.error("[api/analytics] Failed to get users by device:", err);
    res.status(500).json({ error: "Failed to get users by device" });
  }
});

/**
 * GET /api/analytics/users/by-location
 */
router.get("/users/by-location", async (req, res) => {
  try {
    const urlContains = getUrlFilter(req);
    const days = getDaysParam(req, 30);
    const data = await getUniqueUsersByLocation(urlContains, days);
    res.json({ data });
  } catch (err) {
    console.error("[api/analytics] Failed to get users by location:", err);
    res.status(500).json({ error: "Failed to get users by location" });
  }
});

/**
 * GET /api/analytics/archives
 * List monthly archive databases available for historical fetch.
 */
router.get("/archives", async (req, res) => {
  try {
    const data = await getArchiveMonths();
    res.json({ data: data || [] });
  } catch (err) {
    console.error("[api/analytics] Failed to list archives:", err);
    res.status(500).json({ error: "Failed to list archives" });
  }
});

/**
 * GET /api/analytics/referrals
 * Referral source breakdown (Google, Facebook, YouTube, Direct, …)
 * Query: days (default 30, 0 or "all" = all time), date_from, date_to (YYYY-MM-DD)
 */
router.get("/referrals", async (req, res) => {
  try {
    const urlContains = getUrlFilter(req);
    const dateFrom = req.query.date_from || req.query.dateFrom || null;
    const dateTo = req.query.date_to || req.query.dateTo || null;
    const days = getDaysParam(req, 30);
    const lookBack =
      days === 0 || String(days).toLowerCase() === "all"
        ? 0
        : parseInt(days, 10) || 30;
    const data = await getReferralCounts(
      urlContains,
      lookBack,
      dateFrom,
      dateTo,
    );
    res.json({ ...(data || { data: [], totalCount: 0 }) });
  } catch (err) {
    console.error("[api/analytics] Failed to get referrals:", err);
    res.status(500).json({ error: "Failed to get referrals" });
  }
});

/**
 * GET /api/analytics/events/counts
 * Query: days (default 30, 0 or "all" = all time)
 */
router.get("/events/counts", async (req, res) => {
  try {
    const urlContains = getUrlFilter(req);
    const days = getDaysParam(req, 30);
    const data = await getEventCounts(urlContains, days);
    res.json({ ...data });
  } catch (err) {
    console.error("[api/analytics] Failed to get event counts:", err);
    res.status(500).json({ error: "Failed to get event counts" });
  }
});

/**
 * GET /api/analytics/events/purchases
 */
router.get("/events/purchases", async (req, res) => {
  try {
    const limit = clampLimit(req.query.limit);
    const urlContains = getUrlFilter(req);
    const data = await getPurchaseEvents(limit, urlContains);
    res.json({ data });
  } catch (err) {
    console.error("[api/analytics] Failed to get purchase events:", err);
    res.status(500).json({ error: "Failed to get purchase events" });
  }
});

/**
 * GET /api/analytics/events/add-to-cart
 */
router.get("/events/add-to-cart", async (req, res) => {
  try {
    const limit = clampLimit(req.query.limit);
    const urlContains = getUrlFilter(req);
    const data = await getAddToCartEvents(limit, urlContains);
    res.json({ data });
  } catch (err) {
    console.error("[api/analytics] Failed to get add to cart events:", err);
    res.status(500).json({ error: "Failed to get add to cart events" });
  }
});

/**
 * GET /api/analytics/events/stats-by-ips
 * Batch event-type counts for many IPs (replaces N+1 getEventsByIp on Users page).
 * Query: ips=ip1,ip2,... (max 100), days optional
 * MUST be registered before /events/:eventType
 */
router.get("/events/stats-by-ips", async (req, res) => {
  try {
    const raw = req.query.ips || "";
    const ips = String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const site_url = getUrlFilter(req);
    const days = getDaysParam(req, 0);
    const data = await getEventStatsByIps(ips, site_url, days);
    res.json({ data: data || {} });
  } catch (err) {
    console.error("[api/analytics] Failed to get event stats by ips:", err);
    res.status(500).json({ error: "Failed to get event stats by ips" });
  }
});

/**
 * GET /api/analytics/events/by-ip/grouped
 * Recent events for one IP (detail panel). Bounded.
 * MUST be registered before /events/:eventType
 */
router.get("/events/by-ip/grouped", async (req, res) => {
  try {
    const ip = req.query.ip || null;
    const site_url = getUrlFilter(req);
    const limit = clampLimit(req.query.limit, 200, 500);
    const days = getDaysParam(req, 0);
    const data = await getEventsByIpGrouped(ip, site_url, limit, days);
    res.json({ data: data || [] });
  } catch (err) {
    console.error("[api/analytics] Failed to get events by ip:", err);
    res.status(500).json({ error: "Failed to get events by ip" });
  }
});

/**
 * GET /api/analytics/events/:eventType
 * Query: limit (max 300), date_from, date_to, referral (e.g. Google, Facebook)
 */
router.get("/events/:eventType", async (req, res) => {
  try {
    const eventType = req.params.eventType || "";
    const limit = clampLimit(req.query.limit, 50, 300);
    const urlContains = getUrlFilter(req);
    const dateFrom = req.query.date_from || req.query.dateFrom || null;
    const dateTo = req.query.date_to || req.query.dateTo || null;
    const referral =
      req.query.referral || req.query.referral_source || req.query.source || null;
    const data = await getEventsByType(
      eventType,
      limit,
      urlContains,
      dateFrom,
      dateTo,
      referral,
    );
    res.json({ data: data || [] });
  } catch (err) {
    console.error("[api/analytics] Failed to get events by type:", err);
    res.status(500).json({ error: "Failed to get events by type" });
  }
});

/**
 * GET /api/analytics/events/:eventType/by-time
 */
router.get("/events/:eventType/by-time", async (req, res) => {
  try {
    const eventType = req.params.eventType || "";
    const granularity = req.query.granularity === "hourly" ? "hourly" : "daily";
    const days = req.query.days ? parseInt(req.query.days, 10) : null;
    const dateFrom = req.query.date_from || req.query.dateFrom || null;
    const dateTo = req.query.date_to || req.query.dateTo || null;
    const urlContains = getUrlFilter(req);
    const data = await getEventsByTime(
      eventType,
      granularity,
      urlContains,
      days,
      dateFrom,
      dateTo,
    );
    res.json({ data: data || [] });
  } catch (err) {
    console.error("[api/analytics] Failed to get events by time:", err);
    res.status(500).json({ error: "Failed to get events by time" });
  }
});

/**
 * GET /api/analytics/users/recent
 */
router.get("/users/recent", async (req, res) => {
  try {
    const limit = clampLimit(req.query.limit);
    const urlContains = getUrlFilter(req);
    const data = await getRecentUniqueUsers(limit, urlContains);
    res.json({ data });
  } catch (err) {
    console.error("[api/analytics] Failed to get recent users:", err);
    res.status(500).json({ error: "Failed to get recent users" });
  }
});

export default router;
