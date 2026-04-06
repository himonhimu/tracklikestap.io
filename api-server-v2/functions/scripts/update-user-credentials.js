/**
 * Update user_credentials email and password by id (no JWT).
 * Usage: node functions/scripts/update-user-credentials.js <id_cr> <email> <password>
 * Set MYSQL_* in .env (or export them).
 */
import bcrypt from "bcrypt";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getDb } from "../db.js";
import { updateCredentialById } from "../auth-queries.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", ".env") });
// node -e "import('bcrypt').then(async b=>{console.log(await b.default.hash('nextrestart',10));process.exit(0)})"

async function main() {
  const [idArg, email, password] = process.argv.slice(2);
  if (!idArg || !email || !password) {
    console.error(
      "Usage: node functions/scripts/update-user-credentials.js <id_cr> <email> <password>",
    );
    process.exit(1);
  }
  const id = parseInt(idArg, 10);
  if (!id) {
    console.error("Error: id_cr must be a number");
    process.exit(1);
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!normalizedEmail) {
    console.error("Error: email cannot be empty");
    process.exit(1);
  }
  if (String(password).length < 6) {
    console.error("Error: password must be at least 6 characters");
    process.exit(1);
  }

  getDb();
  const password_hash = await bcrypt.hash(String(password), 10);
  const result = await updateCredentialById(id, {
    email: normalizedEmail,
    password_hash,
  });

  if (!result.updated) {
    console.error("Error:", result.error || "Update failed");
    process.exit(1);
  }
  console.log(
    "Updated user_credentials id_cr=%s email=%s",
    id,
    normalizedEmail,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
