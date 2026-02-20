import jwt from "jsonwebtoken";
import { getCredentialById } from "../auth-queries.js";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

/**
 * Require valid JWT. Sets req.user = { id_cr, email, role, site_url }.
 * Responds 401 if no token or invalid.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getCredentialById(decoded.sub);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    req.user = {
      id_cr: user.id_cr,
      email: user.email,
      role: user.role || "user",
      site_url: user.site_url || null,
    };
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    return next(err);
  }
}

/**
 * Resolve effective URL filter for analytics:
 * - normal user: always their site_url (ignore query)
 * - super_admin + query user_id: that user's site_url
 * - super_admin, no user_id: null (all data)
 * Sets req.effectiveUrlFilter (string | null).
 */
export async function resolveEffectiveUrlFilter(req, res, next) {
  if (!req.user) return next();
  const userIdParam = req.query.user_id ?? req.query.userId ?? null;
  if (req.user.role === "super_admin" && userIdParam != null && userIdParam !== "") {
    const selected = await getCredentialById(userIdParam);
    req.effectiveUrlFilter = selected?.site_url ?? null;
  } else if (req.user.role === "super_admin") {
    req.effectiveUrlFilter = null;
  } else {
    req.effectiveUrlFilter = req.user.site_url ?? null;
  }
  next();
}
