import express from "express";
import { processEvent } from "../handler.js";

const router = express.Router();

/**
 * POST /api/event
 * Process an analytics event
 * 
 * Body:
 * {
 *   path: string,
 *   event: "PageView" | "AddToCart" | "Purchase",
 *   product: object (for AddToCart),
 *   products: array (for Purchase),
 *   value: number,
 *   currency: string,
 *   referrer: string,
 *   ts: number,
 *   event_id: string,
 *   ua: string
 * }
 */
router.post("/", async (req, res) => {
  try {
    // Debug: Log request details
    // console.log("[routes/event] 📥 Incoming request:", {
    //   method: req.method,
    //   path: req.path,
    //   headers: {
    //     "x-forwarded-for": req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"],
    //     "x-real-ip": req.headers["x-real-ip"] || req.headers["X-Real-Ip"],
    //     "host": req.headers.host,
    //     "origin": req.headers.origin,
    //     "referer": req.headers.referer,
    //   },
    //   ip: req.ip,
    //   socketRemoteAddress: req.socket?.remoteAddress,
    // });
    
    const result = await processEvent(req.body, req);
    res.json(result);
  } catch (err) {
    console.error("[api/event] Failed to process event:", err);
    res.status(500).json({ 
      ok: false, 
      error: "Failed to process event",
      message: process.env.NODE_ENV === "development" ? err.message : undefined
    });
  }
});

export default router;
