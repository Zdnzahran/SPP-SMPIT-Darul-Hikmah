import cron from 'node-cron';
import { config } from './config.js';
import { buatApp } from './app.js';
import { sinkronTagihan } from './tagihan.js';

async function jalankanSinkron(alasan) {
  try {
    const h = await sinkronTagihan();
    console.log(`[tagihan] ${alasan}: ${h.dibuat} tagihan baru untuk ${h.siswa_terdampak} siswa`);
  } catch (err) {
    console.error(`[tagihan] ${alasan} gagal:`, err);
  }
}

// Tanggal 1 pukul 00.05 WIB. Jika server sempat mati, sinkron saat menyala dan saat login akan menyusul.
cron.schedule('5 0 1 * *', () => jalankanSinkron('cron tanggal 1'), { timezone: 'Asia/Jakarta' });

await jalankanSinkron('server mulai');
buatApp().listen(config.port, () => console.log(`Server berjalan di http://localhost:${config.port}`));
