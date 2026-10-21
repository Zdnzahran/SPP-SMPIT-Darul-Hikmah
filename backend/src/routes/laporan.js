import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { wrap, validasi } from "../errors.js";
import { boolQuery, idSkema } from "../skema.js";
import { sekarangWib } from "../tanggal.js";
import { ringkasanBanyak } from "../ringkasan.js";
import { cariSiswa } from "../dataSiswa.js";

const router = Router();

router.get(
  "/sisa-tagihan",
  wrap(async (req, res) => {
    const f = z
      .object({
        kelas_id: idSkema.optional(),
        siswa_id: idSkema.optional(),
        hanya_menunggak: boolQuery(true),
        status: z.enum(["aktif", "lulus", "semua"]).default("aktif"),
        format: z.enum(["json", "xlsx"]).default("json"),
      })
      .parse(req.query);
    if (f.format === "xlsx")
      throw validasi(
        "Ekspor Excel belum tersedia. Gunakan tombol cetak (bisa simpan sebagai PDF).",
      );

    const siswa = await cariSiswa(pool, f);
    const ringkasan = await ringkasanBanyak(
      pool,
      siswa.map((s) => s.id),
    );

    const baris = siswa
      .map((s) => {
        const m = ringkasan.get(s.id);
        return {
          siswa_id: s.id,
          nama: s.nama,
          kelas: s.kelas,
          sisa_bulanan: m.bulanan.sisa,
          tunggakan_sejak: m.bulanan.tunggakan_sejak,
          sisa_pengembangan: m.pengembangan.sisa,
          sisa_tahunan: m.tahunan.sisa,
          total_sisa: m.total_sisa,
        };
      })
      .filter((b) => !f.hanya_menunggak || b.total_sisa > 0)
      .map((b, i) => ({ no: i + 1, ...b }));

    const jumlah = (k) => baris.reduce((n, b) => n + b[k], 0);
    const [[kelas]] = f.kelas_id
      ? await pool.query("SELECT nama FROM kelas WHERE id = ?", [f.kelas_id])
      : [[null]];

    res.json({
      dicetak_pada: sekarangWib(),
      filter: {
        kelas: kelas?.nama ?? null,
        siswa: f.siswa_id ? (baris[0]?.nama ?? null) : null,
        hanya_menunggak: f.hanya_menunggak,
        status: f.status,
      },
      baris,
      total: {
        sisa_bulanan: jumlah("sisa_bulanan"),
        sisa_pengembangan: jumlah("sisa_pengembangan"),
        sisa_tahunan: jumlah("sisa_tahunan"),
        total_sisa: jumlah("total_sisa"),
        jumlah_siswa: baris.length,
      },
    });
  }),
);

export default router;
