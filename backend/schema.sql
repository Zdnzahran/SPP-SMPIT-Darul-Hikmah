-- Skema database Sistem Rekap SPP. Aman dijalankan berulang (IF NOT EXISTS).
-- Kolom turunan seperti sisa tagihan dan saldo SENGAJA tidak disimpan; dihitung dari tagihan dan pembayaran.

CREATE TABLE IF NOT EXISTS bendahara (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  dibuat_pada DATETIME NOT NULL,
  diubah_pada DATETIME NOT NULL
) DEFAULT CHARSET=utf8mb4;

-- nama_aktif bernilai NULL untuk data yang sudah dihapus, sehingga nama yang pernah dihapus boleh dipakai lagi
-- (UNIQUE mengizinkan banyak NULL).
CREATE TABLE IF NOT EXISTS kelas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(50) NOT NULL,
  dibuat_pada DATETIME NOT NULL,
  diubah_pada DATETIME NOT NULL,
  dihapus_pada DATETIME NULL,
  nama_aktif VARCHAR(50) GENERATED ALWAYS AS (IF(dihapus_pada IS NULL, nama, NULL)) STORED,
  UNIQUE KEY uq_kelas_nama_aktif (nama_aktif)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS spp (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  jenis ENUM('bulanan','pengembangan','tahunan') NOT NULL,
  biaya INT UNSIGNED NOT NULL,
  dibuat_pada DATETIME NOT NULL,
  diubah_pada DATETIME NOT NULL,
  dihapus_pada DATETIME NULL,
  nama_aktif VARCHAR(100) GENERATED ALWAYS AS (IF(dihapus_pada IS NULL, nama, NULL)) STORED,
  UNIQUE KEY uq_spp_jenis_nama_aktif (jenis, nama_aktif),
  CONSTRAINT ck_spp_biaya CHECK (biaya > 0)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS siswa (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  kelas_id INT NOT NULL,
  -- Jenis SPP yang ditagihkan dipilih bebas per siswa; NULL = jenis itu tidak ditagihkan (minimal satu harus terisi, dicek aplikasi).
  spp_bulanan_id INT NULL,
  spp_pengembangan_id INT NULL,
  spp_tahunan_id INT NULL,
  bulan_mulai_tagih DATE NOT NULL,
  status ENUM('aktif','lulus') NOT NULL DEFAULT 'aktif',
  dibuat_pada DATETIME NOT NULL,
  diubah_pada DATETIME NOT NULL,
  dihapus_pada DATETIME NULL,
  INDEX idx_siswa_status (dihapus_pada, status),
  CONSTRAINT fk_siswa_kelas FOREIGN KEY (kelas_id) REFERENCES kelas(id),
  CONSTRAINT fk_siswa_spp_bulanan FOREIGN KEY (spp_bulanan_id) REFERENCES spp(id),
  CONSTRAINT fk_siswa_spp_pengembangan FOREIGN KEY (spp_pengembangan_id) REFERENCES spp(id),
  CONSTRAINT fk_siswa_spp_tahunan FOREIGN KEY (spp_tahunan_id) REFERENCES spp(id)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tagihan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  siswa_id INT NOT NULL,
  jenis ENUM('bulanan','pengembangan','tahunan') NOT NULL,
  -- bulanan: bulan tagihan; tahunan: awal tahun ajaran (mis. 2026-07-01); pengembangan: NULL
  bulan DATE NULL,
  nominal INT UNSIGNED NOT NULL,
  spp_id INT NOT NULL,
  dibuat_pada DATETIME NOT NULL,
  dihapus_pada DATETIME NULL,
  -- Pengaman: tagihan bulanan tidak pernah ganda walau proses sinkron dijalankan berulang.
  UNIQUE KEY uq_tagihan (siswa_id, jenis, bulan),
  INDEX idx_tagihan_siswa_jenis (siswa_id, jenis),
  CONSTRAINT fk_tagihan_siswa FOREIGN KEY (siswa_id) REFERENCES siswa(id),
  CONSTRAINT fk_tagihan_spp FOREIGN KEY (spp_id) REFERENCES spp(id)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pembayaran (
  id INT AUTO_INCREMENT PRIMARY KEY,
  siswa_id INT NOT NULL,
  jenis ENUM('bulanan','pengembangan','tahunan') NOT NULL,
  tanggal DATE NOT NULL,
  nominal INT UNSIGNED NOT NULL,
  catatan VARCHAR(255) NULL,
  sumber ENUM('normal','saldo_awal') NOT NULL DEFAULT 'normal',
  dibuat_pada DATETIME NOT NULL,
  diubah_pada DATETIME NOT NULL,
  dihapus_pada DATETIME NULL,
  INDEX idx_bayar_siswa_jenis (siswa_id, jenis),
  INDEX idx_bayar_tanggal (tanggal),
  CONSTRAINT fk_bayar_siswa FOREIGN KEY (siswa_id) REFERENCES siswa(id),
  CONSTRAINT ck_bayar_nominal CHECK (nominal > 0)
) DEFAULT CHARSET=utf8mb4;
