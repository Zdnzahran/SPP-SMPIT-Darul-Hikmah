import mysql from "mysql2/promise";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const envTestPath = fileURLToPath(new URL("../.env.test", import.meta.url));
const envTest = dotenv.config({ path: envTestPath, override: true });

if (envTest.error) {
  throw new Error(`Tidak dapat membaca konfigurasi test: ${envTestPath}`, {
    cause: envTest.error,
  });
}

export async function runTestSeed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(`DATABASE_URL belum diatur di ${envTestPath}`);
  }

  const connection = await mysql.createConnection(databaseUrl);

  try {
    const [[{ nama_db: namaDb }]] = await connection.query(
      "SELECT DATABASE() AS nama_db",
    );
    if (namaDb !== "spp_test_db") {
      throw new Error(
        `Seed dibatalkan: database yang terhubung adalah "${namaDb}", bukan "spp_test_db".`,
      );
    }

    // Seed bersifat idempotent dan tidak menghapus data lain di database test.
    const passwordHash = await bcrypt.hash(
      process.env.SEED_PASSWORD || "password_test_bendahara",
      12,
    );
    const [bendahara] = await connection.query(
      `INSERT INTO bendahara (username, password_hash, dibuat_pada, diubah_pada)
       VALUES (?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         id = LAST_INSERT_ID(id),
         password_hash = VALUES(password_hash),
         diubah_pada = NOW()`,
      ["bendahara_test", passwordHash],
    );

    const [kelasResult] = await connection.query(
      `INSERT INTO kelas (nama, dibuat_pada, diubah_pada)
       VALUES (?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         id = LAST_INSERT_ID(id),
         diubah_pada = NOW()`,
      ["Kelas 7A Test"],
    );

    const [sppBulananResult] = await connection.query(
      `INSERT INTO spp (nama, jenis, biaya, dibuat_pada, diubah_pada)
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         id = LAST_INSERT_ID(id),
         biaya = VALUES(biaya),
         diubah_pada = NOW()`,
      ["SPP Bulanan Standar Test", "bulanan", 300000],
    );

    const [sppTahunanResult] = await connection.query(
      `INSERT INTO spp (nama, jenis, biaya, dibuat_pada, diubah_pada)
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         id = LAST_INSERT_ID(id),
         biaya = VALUES(biaya),
         diubah_pada = NOW()`,
      ["SPP Tahunan Test", "tahunan", 1200000],
    );

    return {
      bendaharaId: bendahara.insertId,
      kelasId: kelasResult.insertId,
      sppBulananId: sppBulananResult.insertId,
      sppTahunanId: sppTahunanResult.insertId,
    };
  } finally {
    await connection.end();
  }
}

// Izinkan dijalankan langsung dari command line
if (
  process.argv[1] &&
  !process.env.NODE_TEST_CONTEXT &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runTestSeed()
    .then((ids) => {
      console.log("Seed test database berhasil diisi!");
      console.log("ID Data Master:", ids);
    })
    .catch((err) => {
      console.error("Gagal mengisi seed test database:", err);
      process.exit(1);
    });
}
