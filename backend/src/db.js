import mysql from "mysql2/promise";
import { config } from "./config.js";

export const pool = mysql.createPool({
  uri: config.databaseUrl,
  ...(config.production
    ? { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } }
    : {}),
  dateStrings: true,
  decimalNumbers: true,
  connectionLimit: 10,
  waitForConnections: true,
});

// Waktu NOW() di database selalu WIB.
pool.on("connection", (conn) => conn.query("SET time_zone = '+07:00'"));

/** Menjalankan beberapa query dalam satu transaksi: semua berhasil atau semua dibatalkan. */
export async function withTx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const hasil = await fn(conn);
    await conn.commit();
    return hasil;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
