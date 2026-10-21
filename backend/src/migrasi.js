// Memperbarui database LAMA agar mendukung SPP tahunan dan pilihan jenis SPP bebas per siswa.
// Jalankan sekali: npm run db:migrasi   (aman dijalankan berulang; data siswa dan pembayaran tidak berubah)
import { pool } from "./db.js";

const conn = await pool.getConnection();
try {
  await conn.query("SET foreign_key_checks = 0");
  const enumBaru = "ENUM('bulanan','pengembangan','tahunan') NOT NULL";
  for (const tabel of ["spp", "tagihan", "pembayaran"])
    await conn.query(`ALTER TABLE ${tabel} MODIFY jenis ${enumBaru}`);

  const [[{ n }]] = await conn.query(
    "SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'siswa' AND column_name = 'spp_tahunan_id'",
  );
  if (n === 0) {
    await conn.query(`ALTER TABLE siswa
      MODIFY spp_bulanan_id INT NULL,
      MODIFY spp_pengembangan_id INT NULL,
      ADD COLUMN spp_tahunan_id INT NULL AFTER spp_pengembangan_id,
      ADD CONSTRAINT fk_siswa_spp_tahunan FOREIGN KEY (spp_tahunan_id) REFERENCES spp(id)`);
    console.log("Tabel siswa diperbarui.");
  } else {
    console.log("Tabel siswa sudah versi terbaru.");
  }
  await conn.query("SET foreign_key_checks = 1");
  console.log("Migrasi selesai.");
} finally {
  conn.release();
  await pool.end();
}
