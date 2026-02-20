/**
 * One-time script: add email, password_hash, role to user_credentials and optionally set a super admin.
 * Usage: node functions/scripts/add-auth-to-user-credentials.js [email] [password]
 * If email/password are provided, updates the first row (id_cr=1) to that user with role super_admin.
 * Set MYSQL_* env vars (e.g. from .env).
 */
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "..", "..", ".env") });

const HOST = process.env.MYSQL_HOST || "127.0.0.1";
const PORT = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306;
const USER = process.env.MYSQL_USER || "root";
const PASSWORD = process.env.MYSQL_PASSWORD || "";
const DATABASE = process.env.MYSQL_DATABASE || "tracklikestap";

async function main() {
  const [email, password] = process.argv.slice(2);
  try {
    const db = await mysql.createConnection({
      host: HOST,
      port: PORT,
      user: USER,
      password: PASSWORD,
      database: DATABASE,
    });

    console.log("[add-auth] Adding columns to user_credentials if missing...");
    try {
      await db.query(`
        ALTER TABLE user_credentials
          ADD COLUMN email VARCHAR(255) NULL UNIQUE AFTER id_cr,
          ADD COLUMN password_hash VARCHAR(255) NULL AFTER email,
          ADD COLUMN role ENUM('user','super_admin') NOT NULL DEFAULT 'user' AFTER password_hash
      `);
      console.log("[add-auth] Columns added.");
    } catch (e) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log("[add-auth] Columns already exist, skipping ALTER.");
      } else throw e;
    }

    if (email && password) {
      const hash = await bcrypt.hash(password, 10);
      const [r] = await db.query(
        "UPDATE user_credentials SET email = ?, password_hash = ?, role = 'super_admin' WHERE id_cr = 1",
        [email.trim(), hash]
      );
      if (r.affectedRows > 0) {
        console.log("[add-auth] Super admin set for id_cr=1:", email);
      } else {
        console.log("[add-auth] No row with id_cr=1; run UPDATE manually for your row.");
      }
    } else {
      console.log("[add-auth] To set a super admin, run: node functions/scripts/add-auth-to-user-credentials.js <email> <password>");
    }

    await db.end();
    process.exit(0);
  } catch (err) {
    console.error("[add-auth] Error:", err);
    process.exit(1);
  }
}

main();
