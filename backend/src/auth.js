import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from './db.js';
import { config } from './config.js';
import { AppError, wrap } from './errors.js';
import { sinkronTagihan } from './tagihan.js';

const router = Router();
const DELAPAN_JAM = 8 * 60 * 60 * 1000;
const HASH_PALSU = bcrypt.hashSync('hash-palsu-agar-waktu-respons-sama', 10);

const batasLogin = (keyGenerator) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5, // maks. 5 percobaan GAGAL per 15 menit
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (req, res) =>
      res.status(429).json({ error: { kode: 'TERLALU_BANYAK_PERCOBAAN', pesan: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.', detail: [] } }),
  });
const batasPerIp = batasLogin();
const batasPerUsername = batasLogin((req) => String(req.body?.username ?? '').toLowerCase().slice(0, 50) || 'kosong');

export function wajibLogin(req, res, next) {
  try {
    req.bendahara = jwt.verify(req.cookies.token, config.rahasia);
    next();
  } catch {
    next(new AppError(401, 'BELUM_LOGIN', 'Silakan login terlebih dahulu.'));
  }
}

router.post('/login', batasPerIp, batasPerUsername, wrap(async (req, res) => {
  const { username, password } = z.object({ username: z.string().min(1, 'Username wajib diisi'), password: z.string().min(1, 'Password wajib diisi') }).parse(req.body);
  const [rows] = await pool.query('SELECT id, username, password_hash FROM bendahara WHERE username = ?', [username]);
  const b = rows[0];
  const cocok = await bcrypt.compare(password, b?.password_hash ?? HASH_PALSU);
  if (!b || !cocok) throw new AppError(401, 'LOGIN_GAGAL', 'Username atau password salah.');

  const token = jwt.sign({ id: b.id, username: b.username }, config.rahasia, { expiresIn: '8h' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: DELAPAN_JAM });

  // Menyusul tagihan yang mungkin terlewat (mis. server mati saat tanggal 1). Gagal di sini tidak membatalkan login.
  sinkronTagihan().catch((e) => console.error('Sinkron tagihan saat login gagal:', e));
  res.json({ bendahara: { id: b.id, username: b.username } });
}));

router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure });
  res.status(204).end();
});

router.get('/me', wajibLogin, (req, res) => res.json({ id: req.bendahara.id, username: req.bendahara.username }));

router.post('/ganti-password', wajibLogin, wrap(async (req, res) => {
  const { password_lama, password_baru } = z
    .object({ password_lama: z.string().min(1, 'Password lama wajib diisi'), password_baru: z.string().min(8, 'Password baru minimal 8 karakter') })
    .parse(req.body);
  const [rows] = await pool.query('SELECT password_hash FROM bendahara WHERE id = ?', [req.bendahara.id]);
  if (!rows[0] || !(await bcrypt.compare(password_lama, rows[0].password_hash))) {
    throw new AppError(400, 'VALIDASI_GAGAL', 'Password lama salah.');
  }
  await pool.query('UPDATE bendahara SET password_hash = ?, diubah_pada = NOW() WHERE id = ?', [await bcrypt.hash(password_baru, 12), req.bendahara.id]);
  res.status(204).end();
}));

export default router;
