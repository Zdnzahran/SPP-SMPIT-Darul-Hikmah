import { Router } from "express";
import { z } from "zod";
import { pool, withTx } from "../db.js";
import { wrap, tidakDitemukan, validasi } from "../errors.js";
import { idSkema, jenisSkema, rupiahSkema, tanggalSkema } from "../skema.js";
import { hariIni } from "../tanggal.js";
import {
  ringkasanSiswa,
  ringkasanTanpaRincian,
  cekBatasPembayaran,
} from "../ringkasan.js";
import { ambilSiswa } from "../dataSiswa.js";

const router = Router();

const nominal = rupiahSkema.positive("Nominal harus lebih dari 0.");
const tanggalBayar = tanggalSkema.refine(
  (t) => t <= hariIni(),
  "Tanggal pembayaran tidak boleh di masa depan.",
);
const catatan = z
  .string()
  .trim()
  .max(255, "Catatan maksimal 255 karakter")
  .nullish()
  .transform((v) => v || null);

async function ambilBayar(conn, id) {
  const [rows] = await conn.query(
    `SELECT p.id, p.siswa_id, p.jenis, p.tanggal, p.nominal, p.catatan, p.sumber, s.nama AS siswa, k.nama AS kelas
       FROM pembayaran p JOIN siswa s ON s.id = p.siswa_id JOIN kelas k ON k.id = s.kelas_id
      WHERE p.id = ? AND p.dihapus_pada IS NULL`,
    [id],
  );
  return rows[0] ?? null;
}

const ringkasanBersih = async (conn, siswaId) =>
  ringkasanTanpaRincian(await ringkasanSiswa(conn, siswaId));

router.get(
  "/",
  wrap(async (req, res) => {
    const f = z
      .object({
        siswa_id: idSkema.optional(),
        jenis: jenisSkema.optional(),
        dari: tanggalSkema.optional(),
        sampai: tanggalSkema.optional(),
        page: z.coerce.number().int().min(1).default(1),
        per_page: z.coerce.number().int().min(1).max(200).default(25),
      })
      .parse(req.query);

    const where = ["p.dihapus_pada IS NULL", "s.dihapus_pada IS NULL"];
    const prm = [];
    if (f.siswa_id) {
      where.push("p.siswa_id = ?");
      prm.push(f.siswa_id);
    }
    if (f.jenis) {
      where.push("p.jenis = ?");
      prm.push(f.jenis);
    }
    if (f.dari) {
      where.push("p.tanggal >= ?");
      prm.push(f.dari);
    }
    if (f.sampai) {
      where.push("p.tanggal <= ?");
      prm.push(f.sampai);
    }
    const dari = `FROM pembayaran p JOIN siswa s ON s.id = p.siswa_id JOIN kelas k ON k.id = s.kelas_id WHERE ${where.join(" AND ")}`;

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total ${dari}`,
      prm,
    );
    const [data] = await pool.query(
      `SELECT p.id, p.siswa_id, s.nama AS siswa, k.nama AS kelas, p.jenis, p.tanggal, p.nominal, p.catatan, p.sumber
     ${dari} ORDER BY p.tanggal DESC, p.id DESC LIMIT ? OFFSET ?`,
      [...prm, f.per_page, (f.page - 1) * f.per_page],
    );
    res.json({ data, meta: { page: f.page, per_page: f.per_page, total } });
  }),
);

router.post(
  "/",
  wrap(async (req, res) => {
    const d = z
      .object({
        siswa_id: idSkema,
        jenis: jenisSkema,
        tanggal: tanggalBayar,
        nominal,
        catatan,
      })
      .parse(req.body);

    const hasil = await withTx(async (conn) => {
      const siswa = await ambilSiswa(conn, d.siswa_id, true); // kunci baris siswa agar dua pembayaran tidak saling menyalip
      if (!siswa) throw tidakDitemukan("Siswa tidak ditemukan.");
      if (!siswa[`spp_${d.jenis}_id`])
        throw validasi(
          `Siswa ini tidak ditagih SPP ${d.jenis}. Tambahkan jenis itu lewat Edit siswa.`,
        );
      cekBatasPembayaran(
        await ringkasanSiswa(conn, siswa.id),
        d.jenis,
        d.nominal,
        siswa.biaya_bulanan ?? 0,
      );

      const [ins] = await conn.query(
        "INSERT INTO pembayaran (siswa_id, jenis, tanggal, nominal, catatan, sumber, dibuat_pada, diubah_pada) VALUES (?, ?, ?, ?, ?, 'normal', NOW(), NOW())",
        [d.siswa_id, d.jenis, d.tanggal, d.nominal, d.catatan],
      );
      return {
        pembayaran: await ambilBayar(conn, ins.insertId),
        ringkasan_terbaru_siswa: await ringkasanBersih(conn, siswa.id),
      };
    });
    res.status(201).json(hasil);
  }),
);

router.put(
  "/:id",
  wrap(async (req, res) => {
    const id = idSkema.parse(req.params.id);
    const d = z
      .object({ tanggal: tanggalBayar, nominal, catatan })
      .parse(req.body);

    const hasil = await withTx(async (conn) => {
      const lama = await ambilBayar(conn, id);
      if (!lama) throw tidakDitemukan("Pembayaran tidak ditemukan.");
      const siswa = await ambilSiswa(conn, lama.siswa_id, true);
      if (!siswa) throw tidakDitemukan("Siswa tidak ditemukan.");
      // Batas dihitung tanpa pembayaran ini, lalu dicek dengan nominal barunya.
      const r = await ringkasanSiswa(conn, siswa.id, {
        kecualiPembayaranId: id,
      });
      cekBatasPembayaran(r, lama.jenis, d.nominal, siswa.biaya_bulanan ?? 0);

      await conn.query(
        "UPDATE pembayaran SET tanggal = ?, nominal = ?, catatan = ?, diubah_pada = NOW() WHERE id = ?",
        [d.tanggal, d.nominal, d.catatan, id],
      );
      return {
        pembayaran: await ambilBayar(conn, id),
        ringkasan_terbaru_siswa: await ringkasanBersih(conn, siswa.id),
      };
    });
    res.json(hasil);
  }),
);

// Soft delete. Sisa dan saldo otomatis ikut dihitung ulang karena tidak pernah disimpan.
router.delete(
  "/:id",
  wrap(async (req, res) => {
    const id = idSkema.parse(req.params.id);
    if (!(await ambilBayar(pool, id)))
      throw tidakDitemukan("Pembayaran tidak ditemukan.");
    await pool.query(
      "UPDATE pembayaran SET dihapus_pada = NOW() WHERE id = ?",
      [id],
    );
    res.status(204).end();
  }),
);

export default router;
