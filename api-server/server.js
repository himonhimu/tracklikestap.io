import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import eventRoutes from "./routes/event.js";
import analyticsRoutes from "./routes/analytics.js";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from project root
dotenv.config({ path: resolve(__dirname, "", ".env") });

const app = express();
const PORT = process.env.API_PORT || 3001;

// Trust proxy - IMPORTANT for ngrok and reverse proxies
// This allows Express to read x-forwarded-for header correctly
app.set('trust proxy', true);

// Middleware
app.use(cors({
  origin: true, // Allow all origins (or specify your frontend URL)
  credentials: true, // Allow cookies to be sent
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Request logging middleware
// app.use((req, res, next) => {
//   // Log request with IP for debugging
//   const xForwardedFor = req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"] || req.headers["x-forwarded-for"];
//   const clientIp = xForwardedFor ? xForwardedFor.split(",")[0].trim() : req.ip || req.socket?.remoteAddress || "unknown";
//   console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${clientIp}`);
  
//   // Debug: Log all headers on first request to see what we're getting
//   if (req.path === "/api/event" && req.method === "POST") {
//     console.log("[server] 📋 Request headers:", Object.keys(req.headers).reduce((acc, key) => {
//       // Only log IP-related headers to avoid spam
//       if (key.toLowerCase().includes("ip") || 
//           key.toLowerCase().includes("forward") || 
//           key.toLowerCase().includes("client") ||
//           key.toLowerCase() === "host" ||
//           key.toLowerCase() === "origin" ||
//           key.toLowerCase() === "referer") {
//         acc[key] = req.headers[key];
//       }
//       return acc;
//     }, {}));
//   }
  
//   next();
// });

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
app.get("/api/get-pixel", (req, res) => {
  res.json({ pixel: process.env.FB_PIXEL_ID || null });
});

// API Routes
app.use("/api/event", eventRoutes);
app.use("/api/analytics", analyticsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("[server] Error:", err);
  res.status(500).json({ 
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[server] API server running on port ${PORT}`);
  console.log(`[server] Health check: http://localhost:${PORT}/health`);
  console.log(`[server] Event endpoint: http://localhost:${PORT}/api/event`);
  console.log(`[server] Analytics endpoint: http://localhost:${PORT}/api/analytics`);
});

export default app;
