import express from "express";
import { processEvent } from "../handler.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const result = await processEvent(req.body, req);
    res.json(result);
  } catch (err) {
    console.error("[api/event] Failed to process event:", err);
    res.status(500).json({
      ok: false,
      error: "Failed to process event",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

export default router;
