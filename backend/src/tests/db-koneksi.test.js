import test from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

// Muat variabel lingkungan dari .env.test
dotenv.config({ path: ".env.test" });

test("Verifikasi koneksi ke database uji spp_test_db", async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL harus ada di .env.test");

  // Buat koneksi langsung menggunakan DATABASE_URL
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    // 1. database yang sedang aktif adalah spp_test_db
    const [dbResult] = await connection.query("SELECT DATABASE() AS nama_db");
    assert.equal(
      dbResult[0].nama_db,
      "spp_test_db",
      "Harus terhubung ke database spp_test_db, bukan database lain!",
    );

    // 2. tabel hasil import schema.sql sudah terbaca
    const [tables] = await connection.query("SHOW TABLES");
    assert.ok(
      tables.length > 0,
      "Database uji harus memiliki tabel dari schema.sql",
    );
  } finally {
    // Tutup koneksi agar test tidak menggantung
    await connection.end();
  }
});
