import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { wrap, tidakDitemukan, konflik } from '../errors.js';
import { idSkema } from '../skema.js';

const router = Router();
const skema = z.object({ nama: z.string().trim().min(1, 'Nama kelas wajib diisi').max(50, 'Nama kelas maksimal 50 karakter') });

async function ambil(id) {
  const [rows] = await pool.query('SELECT id, nama FROM kelas WHERE id = ? AND dihapus_pada IS NULL', [id]);
  if (!rows[0]) throw tidakDitemukan('Kelas tidak ditemukan.');
  return rows[0];
}

router.get('/', wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT k.id, k.nama,
            (SELECT COUNT(*) FROM siswa s WHERE s.kelas_id = k.id AND s.dihapus_pada IS NULL AND s.status = 'aktif') AS jumlah_siswa_aktif
       FROM kelas k WHERE k.dihapus_pada IS NULL ORDER BY k.nama`,
  );
  res.json(rows);
}));

router.post('/', wrap(async (req, res) => {
  const { nama } = skema.parse(req.body);
  const [r] = await pool.query('INSERT INTO kelas (nama, dibuat_pada, diubah_pada) VALUES (?, NOW(), NOW())', [nama]);
  res.status(201).json({ id: r.insertId, nama, jumlah_siswa_aktif: 0 });
}));

router.put('/:id', wrap(async (req, res) => {
  const id = idSkema.parse(req.params.id);
  const { nama } = skema.parse(req.body);
  await ambil(id);
  await pool.query('UPDATE kelas SET nama = ?, diubah_pada = NOW() WHERE id = ?', [nama, id]);
  res.json({ id, nama });
}));

router.delete('/:id', wrap(async (req, res) => {
  const id = idSkema.parse(req.params.id);
  await ambil(id);
  const [[{ n }]] = await pool.query(
    "SELECT COUNT(*) AS n FROM siswa WHERE kelas_id = ? AND dihapus_pada IS NULL AND status = 'aktif'", [id]);
  if (n > 0) throw konflik(`Kelas masih dipakai ${n} siswa aktif. Pindahkan siswanya dulu.`);
  await pool.query('UPDATE kelas SET dihapus_pada = NOW() WHERE id = ?', [id]);
  res.status(204).end();
}));

export default router;
