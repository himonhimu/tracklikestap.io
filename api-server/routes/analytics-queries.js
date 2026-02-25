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
} from "../analytics-queries";

const router = express.Router();

function getUrlFilter(req) {
  return req.effectiveUrlFilter !== undefined
    ? req.effectiveUrlFilter
    : req.query.url_contains || req.query.urlContains || null;
}

/**
 * GET /api/analytics/users/total
 * Get total unique users count
 */
router.get("/users/total", async (req, res) => {
  try {
    const urlContains = getUrlFilter(req);
    const count = await getTotalUniqueUsers(urlContains);
    res.json({ count });
  } catch (err) {
    console.error("[api/analytics] Failed to get total users:", err);
    res.status(500).json({ error: "Failed to get total users" });
  }
});

/**
 * GET /api/analytics/users/by-device
 * Get unique users grouped by device type
 */
router.get("/users/by-device", async (req, res) => {
  try {
    const urlContains = getUrlFilter(req);
    const data = await getUniqueUsersByDevice(urlContains);
    res.json({ data });
  } catch (err) {
    console.error("[api/analytics] Failed to get users by device:", err);
    res.status(500).json({ error: "Failed to get users by device" });
  }
});

/**
 * GET /api/analytics/users/by-location
 * Get unique users grouped by location
 */
router.get("/users/by-location", async (req, res) => {
  try {
    const urlContains = getUrlFilter(req);
    const data = await getUniqueUsersByLocation(urlContains);
    res.json({ data });
  } catch (err) {
    console.error("[api/analytics] Failed to get users by location:", err);
    res.status(500).json({ error: "Failed to get users by location" });
  }
});

/**
 * GET /api/analytics/events/counts
 * Get event counts by type
 */
router.get("/events/counts", async (req, res) => {
  try {
    const urlContains = getUrlFilter(req);
    const data = await getEventCounts(urlContains);
    res.json({ ...data });
  } catch (err) {
    console.error("[api/analytics] Failed to get event counts:", err);
    res.status(500).json({ error: "Failed to get event counts" });
  }
});

/**
 * GET /api/analytics/events/purchases
 * Get recent purchase events
 * Query params: limit (default: 50)
 */
router.get("/events/purchases", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
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
 * Get recent add to cart events
 * Query params: limit (default: 50)
 */
router.get("/events/add-to-cart", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const urlContains = getUrlFilter(req);
    const data = await getAddToCartEvents(limit, urlContains);
    res.json({ data });
  } catch (err) {
    console.error("[api/analytics] Failed to get add to cart events:", err);
    res.status(500).json({ error: "Failed to get add to cart events" });
  }
});

/**
 * GET /api/analytics/events/:eventType
 * Get recent events for a given type (e.g. Purchase, AddToCart, PageView).
 * Query params: limit (default: 50), url_contains
 */
router.get("/events/:eventType", async (req, res) => {
  try {
    const eventType = req.params.eventType || "";
    const limit = parseInt(req.query.limit, 10) || 50;
    const urlContains = getUrlFilter(req);
    const data = await getEventsByType(eventType, limit, urlContains);
    res.json({ data: data || [] });
  } catch (err) {
    console.error("[api/analytics] Failed to get events by type:", err);
    res.status(500).json({ error: "Failed to get events by type" });
  }
});

/**
 * GET /api/analytics/events/:eventType/by-time
 * Get event counts for a given type grouped by time (hourly or daily).
 * eventType: e.g. Purchase, AddToCart (use exact event_type from DB).
 * Query params: granularity=hourly|daily (default: daily), days, date_from (YYYY-MM-DD), date_to (YYYY-MM-DD), url_contains
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
router.get("/events/by-ip/grouped", async (req, res) => {
  try {
    const ip = req.query.ip || null;
    const data = await getEventsByIpGrouped(ip);
    res.json({ data: data || [] });
  } catch (err) {
    console.error("[api/analytics] Failed to get events by time:", err);
    res.status(500).json({ error: "Failed to get events by time" });
  }
});

/**
 * GET /api/analytics/users/recent
 * Get recent unique users
 * Query params: limit (default: 50)
 */
router.get("/users/recent", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const urlContains = getUrlFilter(req);
    const data = await getRecentUniqueUsers(limit, urlContains);
    res.json({ data });
  } catch (err) {
    console.error("[api/analytics] Failed to get recent users:", err);
    res.status(500).json({ error: "Failed to get recent users" });
  }
});

export default router;
