/**
 * Auth and user_credentials queries for dashboard login.
 */

import { getDb } from "./db.js";

/**
 * Get user_credentials by email (for login). Returns id_cr, email, password_hash, role, site_url, pixel_id.
 */
export async function getCredentialByEmail(email) {
  const db = getDb();
  if (!db) return null;
  const normalized = String(email).trim().toLowerCase();
  if (!normalized) return null;
  try {
    const [rows] = await db.execute(
      "SELECT id_cr, email, password_hash, role, site_url, pixel_id FROM user_credentials WHERE LOWER(TRIM(email)) = ? LIMIT 1",
      [normalized]
    );
    return rows[0] || null;
  } catch (err) {
    console.error("[auth] getCredentialByEmail error:", err);
    return null;
  }
}

/**
 * Get user by id_cr (for JWT payload and listing). Excludes access_token, password_hash.
 */
export async function getCredentialById(idCr) {
  const db = getDb();
  if (!db) return null;
  const id = parseInt(idCr, 10);
  if (!id) return null;
  try {
    const [rows] = await db.execute(
      "SELECT id_cr, email, role, site_url, pixel_id FROM user_credentials WHERE id_cr = ? LIMIT 1",
      [id]
    );
    return rows[0] || null;
  } catch (err) {
    console.error("[auth] getCredentialById error:", err);
    return null;
  }
}

/**
 * List all users (for super_admin). Returns id_cr, email, role, site_url only.
 */
export async function listUsers() {
  const db = getDb();
  if (!db) return [];
  try {
    const [rows] = await db.execute(
      "SELECT id_cr, email, role, site_url FROM user_credentials ORDER BY id_cr ASC"
    );
    return rows;
  } catch (err) {
    console.error("[auth] listUsers error:", err);
    return [];
  }
}

/**
 * Get one user by id_cr for super_admin edit form. Returns all fields except password_hash.
 */
export async function getCredentialByIdForAdmin(idCr) {
  const db = getDb();
  if (!db) return null;
  const id = parseInt(idCr, 10);
  if (!id) return null;
  try {
    const [rows] = await db.execute(
      "SELECT id_cr, email, role, site_url, pixel_id, access_token, test_code FROM user_credentials WHERE id_cr = ? LIMIT 1",
      [id]
    );
    return rows[0] || null;
  } catch (err) {
    console.error("[auth] getCredentialByIdForAdmin error:", err);
    return null;
  }
}

const ALLOWED_ROLES = ["user", "super_admin"];

/**
 * Update user_credentials by id_cr. Supports: email, password_hash, role, pixel_id, access_token, test_code, site_url.
 * @param {number} idCr - user_credentials.id_cr
 * @param {{ email?: string, password_hash?: string, role?: string, pixel_id?: string, access_token?: string, test_code?: string, site_url?: string }} updates
 * @returns {{ updated: boolean, error?: string }}
 */
export async function updateCredentialById(idCr, updates) {
  const db = getDb();
  if (!db) return { updated: false, error: "Database unavailable" };
  const id = parseInt(idCr, 10);
  if (!id) return { updated: false, error: "Invalid id" };
  const { email, password_hash, role, pixel_id, access_token, test_code, site_url } = updates;
  const parts = [];
  const values = [];
  if (email !== undefined) {
    const normalized = String(email).trim().toLowerCase();
    if (!normalized) return { updated: false, error: "Email cannot be empty" };
    parts.push("email = ?");
    values.push(normalized);
  }
  if (password_hash != null) {
    parts.push("password_hash = ?");
    values.push(password_hash);
  }
  if (role !== undefined) {
    const r = String(role).trim();
    if (!ALLOWED_ROLES.includes(r)) return { updated: false, error: "Invalid role" };
    parts.push("role = ?");
    values.push(r);
  }
  if (pixel_id !== undefined) {
    parts.push("pixel_id = ?");
    values.push(pixel_id === null || pixel_id === "" ? null : String(pixel_id));
  }
  if (access_token !== undefined) {
    parts.push("access_token = ?");
    values.push(access_token === null || access_token === "" ? null : String(access_token));
  }
  if (test_code !== undefined) {
    parts.push("test_code = ?");
    values.push(test_code === null || test_code === "" ? null : String(test_code));
  }
  if (site_url !== undefined) {
    parts.push("site_url = ?");
    values.push(site_url === null || site_url === "" ? null : String(site_url));
  }
  if (parts.length === 0) {
    return { updated: false, error: "No fields to update" };
  }
  try {
    values.push(id);
    await db.execute(
      `UPDATE user_credentials SET ${parts.join(", ")} WHERE id_cr = ?`,
      values
    );
    return { updated: true };
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return { updated: false, error: "Email already in use" };
    }
    console.error("[auth] updateCredentialById error:", err);
    return { updated: false, error: "Update failed" };
  }
}
