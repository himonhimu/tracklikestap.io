import mysql from "mysql2/promise";

let pool;

export function getDb() {
  if (!pool) {
    const {
      MYSQL_HOST,
      MYSQL_PORT,
      MYSQL_USER,
      MYSQL_PASSWORD,
      MYSQL_DATABASE,
    } = process.env;

    if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_DATABASE) {
      console.warn(
        "[analytics] Missing MySQL env vars (MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE). Skipping DB logging."
      );
      return null;
    }

    pool = mysql.createPool({
      host: MYSQL_HOST,
      port: MYSQL_PORT ? Number(MYSQL_PORT) : 3306,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }

  return pool;
}

