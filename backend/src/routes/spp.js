import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { wrap, tidakDitemukan, konflik } from "../errors.js";
import { idSkema, jenisSkema } from "../skema.js";

const router = Router();
const nama = z
  .string()
  .trim()
  .min(1, "Nama SPP wajib diisi")
  .max(100, "Nama SPP maksimal 100 karakter");
const biaya = z
  .number({ invalid_type_error: "Biaya harus berupa angka." })
  .int("Biaya harus bilangan bulat.")
  .positive("Biaya harus lebih dari 0.");

async function ambil(id) {
  const [rows] = await pool.query(
    "SELECT id, nama, jenis, biaya FROM spp WHERE id = ? AND dihapus_pada IS NULL",
    [id],
  );
  if (!rows[0]) throw tidakDitemukan("SPP tidak ditemukan.");
  return rows[0];
}

router.get(
  "/",
  wrap(async (req, res) => {
    const { jenis } = z
      .object({ jenis: jenisSkema.optional() })
      .parse(req.query);
    const [rows] = await pool.query(
      `SELECT id, nama, jenis, biaya FROM spp WHERE dihapus_pada IS NULL ${jenis ? "AND jenis = ?" : ""} ORDER BY jenis, biaya DESC, nama`,
      jenis ? [jenis] : [],
    );
    res.json(rows);
  }),
);

router.post(
  "/",
  wrap(async (req, res) => {
    const d = z.object({ nama, jenis: jenisSkema, biaya }).parse(req.body);
    const [r] = await pool.query(
      "INSERT INTO spp (nama, jenis, biaya, dibuat_pada, diubah_pada) VALUES (?, ?, ?, NOW(), NOW())",
      [d.nama, d.jenis, d.biaya],
    );
    res.status(201).json({ id: r.insertId, ...d });
  }),
);

// Mengubah biaya TIDAK mengubah tagihan yang sudah terbit; hanya tagihan bulanan berikutnya yang memakai biaya baru.
router.put(
  "/:id",
  wrap(async (req, res) => {
    const id = idSkema.parse(req.params.id);
    const d = z.object({ nama, biaya }).parse(req.body);
    const lama = await ambil(id);
    await pool.query(
      "UPDATE spp SET nama = ?, biaya = ?, diubah_pada = NOW() WHERE id = ?",
      [d.nama, d.biaya, id],
    );
    res.json({ id, jenis: lama.jenis, ...d });
  }),
);

router.delete(
  "/:id",
  wrap(async (req, res) => {
    const id = idSkema.parse(req.params.id);
    await ambil(id);
    const [[{ n }]] = await pool.query(
      `SELECT COUNT(*) AS n FROM siswa
      WHERE (spp_bulanan_id = ? OR spp_pengembangan_id = ? OR spp_tahunan_id = ?) AND dihapus_pada IS NULL AND status = 'aktif'`,
      [id, id, id],
    );
    if (n > 0)
      throw konflik(
        `SPP masih dipakai ${n} siswa aktif. Ganti golongan siswanya dulu.`,
      );
    await pool.query("UPDATE spp SET dihapus_pada = NOW() WHERE id = ?", [id]);
    res.status(204).end();
  }),
);

export default router;
