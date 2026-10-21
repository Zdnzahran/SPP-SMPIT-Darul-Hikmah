// Mengisi akun bendahara dan 4 golongan SPP bulanan.  Jalankan: npm run seed
// SPP pengembangan tidak di-seed karena nominalnya belum diketahui; isi lewat halaman SPP.
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const password = process.env.SEED_PASSWORD || process.argv[2];
if (!password || password.length < 8) {
  console.error('Isi SEED_PASSWORD di .env (minimal 8 karakter).');
  process.exit(1);
}

const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM bendahara');
if (n === 0) {
  await pool.query('INSERT INTO bendahara (username, password_hash, dibuat_pada, diubah_pada) VALUES (?, ?, NOW(), NOW())', [
    'bendahara',
    await bcrypt.hash(password, 12),
  ]);
  console.log('Akun dibuat: username "bendahara". Segera ganti password setelah login.');
} else {
  console.log('Akun bendahara sudah ada, dilewati.');
}

const [[{ m }]] = await pool.query("SELECT COUNT(*) AS m FROM spp WHERE jenis = 'bulanan' AND dihapus_pada IS NULL");
if (m === 0) {
  const golongan = [150000, 100000, 75000, 50000];
  for (const [i, biaya] of golongan.entries()) {
    await pool.query("INSERT INTO spp (nama, jenis, biaya, dibuat_pada, diubah_pada) VALUES (?, 'bulanan', ?, NOW(), NOW())", [
      `Bulanan Golongan ${i + 1}`,
      biaya,
    ]);
  }
  console.log('4 golongan SPP bulanan dibuat.');
}
await pool.end();
