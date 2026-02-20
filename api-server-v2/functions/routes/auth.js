import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getCredentialByEmail, getCredentialById, getCredentialByIdForAdmin, listUsers, updateCredentialById } from "../auth-queries.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user: { id_cr, email, role, site_url } }
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const cred = await getCredentialByEmail(email);
    if (!cred || !cred.password_hash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const match = await bcrypt.compare(String(password), cred.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const user = {
      id_cr: cred.id_cr,
      email: cred.email,
      role: cred.role || "user",
      site_url: cred.site_url || null,
    };
    const token = jwt.sign(
      { sub: cred.id_cr, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    return res.json({ token, user });
  } catch (err) {
    console.error("[auth] login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

/**
 * GET /api/auth/me
 * Requires: Authorization: Bearer <token>
 * Returns: { user: { id_cr, email, role, site_url } }
 */
router.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

/**
 * GET /api/auth/users
 * Requires: super_admin role. Returns list of users for the "select user" dropdown.
 */
router.get("/users", requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const users = await listUsers();
    return res.json({ data: users });
  } catch (err) {
    console.error("[auth] users list error:", err);
    return res.status(500).json({ error: "Failed to list users" });
  }
});

/**
 * GET /api/auth/users/:id
 * super_admin only. Returns one user's details (no password) for editing.
 */
router.get("/users/:id", requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Invalid user id" });
    const user = await getCredentialByIdForAdmin(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ data: user });
  } catch (err) {
    console.error("[auth] get user error:", err);
    return res.status(500).json({ error: "Failed to get user" });
  }
});

/**
 * PUT /api/auth/users/:id
 * super_admin only. Body: { email?, password?, role?, pixel_id?, access_token?, test_code?, site_url? }
 */
router.put("/users/:id", requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Invalid user id" });
    const { email, password, role, pixel_id, access_token, test_code, site_url } = req.body || {};
    const updates = {};
    if (email !== undefined) {
      updates.email = String(email).trim().toLowerCase();
      if (!updates.email) return res.status(400).json({ error: "Email cannot be empty" });
    }
    if (password !== undefined && password !== "") {
      if (String(password).length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      updates.password_hash = await bcrypt.hash(String(password), 10);
    }
    if (role !== undefined) updates.role = role;
    if (pixel_id !== undefined) updates.pixel_id = pixel_id;
    if (access_token !== undefined) updates.access_token = access_token;
    if (test_code !== undefined) updates.test_code = test_code;
    if (site_url !== undefined) updates.site_url = site_url;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    const result = await updateCredentialById(id, updates);
    if (!result.updated) {
      const status = result.error === "Email already in use" ? 409 : 400;
      return res.status(status).json({ error: result.error || "Update failed" });
    }
    return res.json({ ok: true, message: "User updated" });
  } catch (err) {
    console.error("[auth] update user error:", err);
    return res.status(500).json({ error: "Update failed" });
  }
});

export default router;
export { JWT_SECRET };
