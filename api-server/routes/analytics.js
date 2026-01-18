import express from "express";
import {
  getTotalUniqueUsers,
  getUniqueUsersByDevice,
  getUniqueUsersByLocation,
  getEventCounts,
  getPurchaseEvents,
  getAddToCartEvents,
  getRecentUniqueUsers,
} from "../analytics-queries.js";

const router = express.Router();

/**
 * GET /api/analytics/users/total
 * Get total unique users count
 */
router.get("/users/total", async (req, res) => {
  try {
    const count = await getTotalUniqueUsers();
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
    const data = await getUniqueUsersByDevice();
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
    const data = await getUniqueUsersByLocation();
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
    const data = await getEventCounts();
    res.json({ data });
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
    const data = await getPurchaseEvents(limit);
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
    const data = await getAddToCartEvents(limit);
    res.json({ data });
  } catch (err) {
    console.error("[api/analytics] Failed to get add to cart events:", err);
    res.status(500).json({ error: "Failed to get add to cart events" });
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
    const data = await getRecentUniqueUsers(limit);
    res.json({ data });
  } catch (err) {
    console.error("[api/analytics] Failed to get recent users:", err);
    res.status(500).json({ error: "Failed to get recent users" });
  }
});

export default router;
