import { Router } from "express";
import { z } from "zod";
import { pool, withTx } from "../db.js";
import { config } from "../config.js";
import { wrap, tidakDitemukan, validasi } from "../errors.js";
import { bulanSkema, boolQuery, idSkema, rupiahSkema } from "../skema.js";
import { awalTahunAjaran, bulanBerjalan } from "../tanggal.js";
import { sinkronTagihan } from "../tagihan.js";
import {
  ringkasanBanyak,
  ringkasanSiswa,
  ringkasanTanpaRincian,
  cekBatasPembayaran,
} from "../ringkasan.js";
import { ambilSiswa, cariSiswa } from "../dataSiswa.js";

const router = Router();

const JENIS = ["bulanan", "pengembangan", "tahunan"];
const kolom = (jenis) => `spp_${jenis}_id`;

const nama = z
  .string()
  .trim()
  .min(1, "Nama siswa wajib diisi")
  .max(100, "Nama siswa maksimal 100 karakter");
// Golongan tiap jenis SPP boleh kosong (null) = jenis itu tidak ditagihkan ke siswa ini.
const idOpsional = idSkema.nullish().transform((v) => v ?? null);
const dasar = {
  nama,
  kelas_id: idSkema,
  spp_bulanan_id: idOpsional,
  spp_pengembangan_id: idOpsional,
  spp_tahunan_id: idOpsional,
};
const minimalSatu = [
  (d) => d.spp_bulanan_id || d.spp_pengembangan_id || d.spp_tahunan_id,
  {
    message: "Pilih minimal satu jenis SPP yang ditagihkan.",
    path: ["spp_bulanan_id"],
  },
];

/** Memeriksa kelas dan golongan SPP yang dipilih. Mengembalikan { bulanan, pengembangan, tahunan } (null jika tidak dipilih). */
async function cekReferensi(conn, d) {
  const [k] = await conn.query(
    "SELECT id FROM kelas WHERE id = ? AND dihapus_pada IS NULL",
    [d.kelas_id],
  );
  if (!k[0]) throw validasi("Kelas tidak ditemukan.");
  const spp = {};
  for (const jenis of JENIS) {
    const id = d[kolom(jenis)];
    if (!id) {
      spp[jenis] = null;
      continue;
    }
    const [r] = await conn.query(
      "SELECT id, biaya FROM spp WHERE id = ? AND jenis = ? AND dihapus_pada IS NULL",
      [id, jenis],
    );
    if (!r[0]) throw validasi(`SPP ${jenis} tidak ditemukan.`);
    spp[jenis] = r[0];
  }
  return spp;
}

const tambahTagihanPengembangan = (conn, siswaId, sppPeng) =>
  conn.query(
    "INSERT INTO tagihan (siswa_id, jenis, bulan, nominal, spp_id, dibuat_pada) VALUES (?, 'pengembangan', NULL, ?, ?, NOW())",
    [siswaId, sppPeng.biaya, sppPeng.id],
  );

// ---------- Daftar ----------
router.get(
  "/",
  wrap(async (req, res) => {
    const f = z
      .object({
        kelas_id: idSkema.optional(),
        status: z.enum(["aktif", "lulus", "semua"]).default("aktif"),
        q: z.string().trim().optional(),
        hanya_menunggak: boolQuery(false),
        page: z.coerce.number().int().min(1).default(1),
        per_page: z.coerce.number().int().min(1).max(200).default(25),
      })
      .parse(req.query);

    const rows = await cariSiswa(pool, f);
    const ringkasan = await ringkasanBanyak(
      pool,
      rows.map((r) => r.id),
    );
    let data = rows.map((r) => {
      const m = ringkasan.get(r.id);
      return {
        ...r,
        sisa_bulanan: m.bulanan.sisa,
        saldo_bulanan: m.bulanan.saldo,
        tunggakan_sejak: m.bulanan.tunggakan_sejak,
        sisa_pengembangan: m.pengembangan.sisa,
        sisa_tahunan: m.tahunan.sisa,
        total_sisa: m.total_sisa,
      };
    });
    if (f.hanya_menunggak) data = data.filter((d) => d.total_sisa > 0);
    const total = data.length;
    data = data.slice((f.page - 1) * f.per_page, f.page * f.per_page);
    res.json({ data, meta: { page: f.page, per_page: f.per_page, total } });
  }),
);

// ---------- Tambah siswa ----------
router.post(
  "/",
  wrap(async (req, res) => {
    const d = z
      .object({
        ...dasar,
        bulan_mulai_tagih: bulanSkema.optional(),
        saldo_awal: z
          .object({
            bulanan_sudah_dibayar: rupiahSkema.min(0).optional(),
            pengembangan_sudah_dibayar: rupiahSkema.min(0).optional(),
            tahunan_sudah_dibayar: rupiahSkema.min(0).optional(),
          })
          .optional(),
      })
      .refine(...minimalSatu)
      .parse(req.body);
    const mulai = d.bulan_mulai_tagih ?? bulanBerjalan();

    const hasil = await withTx(async (conn) => {
      const spp = await cekReferensi(conn, d);
      const [kembar] = await conn.query(
        "SELECT id FROM siswa WHERE nama = ? AND kelas_id = ? AND dihapus_pada IS NULL",
        [d.nama, d.kelas_id],
      );

      const [ins] = await conn.query(
        `INSERT INTO siswa (nama, kelas_id, spp_bulanan_id, spp_pengembangan_id, spp_tahunan_id, bulan_mulai_tagih, status, dibuat_pada, diubah_pada)
       VALUES (?, ?, ?, ?, ?, ?, 'aktif', NOW(), NOW())`,
        [
          d.nama,
          d.kelas_id,
          d.spp_bulanan_id,
          d.spp_pengembangan_id,
          d.spp_tahunan_id,
          mulai,
        ],
      );
      const id = ins.insertId;

      // Pengembangan: satu tagihan penuh. Bulanan dan tahunan diterbitkan oleh sinkronTagihan.
      if (spp.pengembangan)
        await tambahTagihanPengembangan(conn, id, spp.pengembangan);
      await sinkronTagihan(conn, { siswaId: id });

      // Saldo awal untuk siswa lama / masuk tengah tahun: dicatat sebagai pembayaran bersumber 'saldo_awal'.
      const awal = d.saldo_awal ?? {};
      for (const jenis of JENIS) {
        const nominal = awal[`${jenis}_sudah_dibayar`];
        if (!nominal) continue;
        if (!spp[jenis])
          throw validasi(
            `"Sudah dibayar" ${jenis} diisi, tetapi SPP ${jenis} tidak dipilih.`,
          );
        cekBatasPembayaran(
          await ringkasanSiswa(conn, id),
          jenis,
          nominal,
          spp.bulanan?.biaya ?? 0,
        );
        await conn.query(
          "INSERT INTO pembayaran (siswa_id, jenis, tanggal, nominal, catatan, sumber, dibuat_pada, diubah_pada) VALUES (?, ?, CURDATE(), ?, 'Saldo awal', 'saldo_awal', NOW(), NOW())",
          [id, jenis, nominal],
        );
      }

      return {
        siswa: await ambilSiswa(conn, id),
        ringkasan: ringkasanTanpaRincian(await ringkasanSiswa(conn, id)),
        peringatan: kembar.length
          ? `Sudah ada ${kembar.length} siswa dengan nama dan kelas yang sama. Pastikan ini bukan data ganda.`
          : null,
      };
    });

    res
      .status(201)
      .json({
        ...hasil.siswa,
        ringkasan_tagihan: hasil.ringkasan,
        peringatan: hasil.peringatan,
      });
  }),
);

// ---------- Detail ----------
router.get(
  "/:id",
  wrap(async (req, res) => {
    const id = idSkema.parse(req.params.id);
    const siswa = await ambilSiswa(pool, id);
    if (!siswa) throw tidakDitemukan("Siswa tidak ditemukan.");
    const r = await ringkasanSiswa(pool, id);

    const tagihan = [];
    if (siswa.spp_pengembangan_id) {
      tagihan.push({
        jenis: "pengembangan",
        bulan: null,
        nominal: r.pengembangan.total_tagihan,
        terbayar: Math.min(
          r.pengembangan.total_tagihan,
          r.pengembangan.total_dibayar,
        ),
        sisa: r.pengembangan.sisa,
      });
    }
    if (siswa.spp_tahunan_id)
      tagihan.push(
        ...r.tahunan.rincian.map((x) => ({ jenis: "tahunan", ...x })).reverse(),
      );
    if (siswa.spp_bulanan_id)
      tagihan.push(
        ...r.bulanan.rincian.map((x) => ({ jenis: "bulanan", ...x })).reverse(),
      );

    const [pembayaran] = await pool.query(
      `SELECT id, jenis, tanggal, nominal, catatan, sumber FROM pembayaran
      WHERE siswa_id = ? AND dihapus_pada IS NULL ORDER BY tanggal DESC, id DESC`,
      [id],
    );
    res.json({
      siswa,
      ringkasan: ringkasanTanpaRincian(r),
      tagihan,
      pembayaran,
    });
  }),
);

// ---------- Ubah data (termasuk kenaikan kelas, tambah / cabut jenis SPP, ganti golongan) ----------
router.put(
  "/:id",
  wrap(async (req, res) => {
    const id = idSkema.parse(req.params.id);
    const d = z
      .object({ ...dasar, berlaku_mulai_bulan: bulanSkema.optional() })
      .refine(...minimalSatu)
      .parse(req.body);

    const hasil = await withTx(async (conn) => {
      const s = await ambilSiswa(conn, id, true);
      if (!s) throw tidakDitemukan("Siswa tidak ditemukan.");
      const spp = await cekReferensi(conn, d);

      const dicabut = (j) => s[kolom(j)] && !d[kolom(j)];
      const ditambah = (j) => !s[kolom(j)] && d[kolom(j)];
      const diganti = (j) =>
        s[kolom(j)] && d[kolom(j)] && s[kolom(j)] !== d[kolom(j)];

      if (diganti("bulanan") || diganti("tahunan")) {
        const b = d.berlaku_mulai_bulan;
        if (!b)
          throw validasi(
            'Isi "berlaku mulai bulan" karena golongan SPP bulanan/tahunan diganti.',
          );
        if (b < s.bulan_mulai_tagih || b > bulanBerjalan()) {
          throw validasi(
            '"Berlaku mulai bulan" harus di antara bulan mulai tagih siswa dan bulan berjalan.',
          );
        }
      }

      // Mencabut jenis hanya boleh jika belum ada pembayarannya; tagihan jenis itu ikut dihapus.
      const sebelum = await ringkasanSiswa(conn, id);
      for (const j of JENIS.filter(dicabut)) {
        if (sebelum[j].total_dibayar > 0)
          throw validasi(
            `SPP ${j} tidak bisa dicabut karena sudah ada pembayarannya. Hapus pembayarannya dulu.`,
          );
        await conn.query(
          "DELETE FROM tagihan WHERE siswa_id = ? AND jenis = ?",
          [id, j],
        );
      }

      await conn.query(
        `UPDATE siswa SET nama = ?, kelas_id = ?, spp_bulanan_id = ?, spp_pengembangan_id = ?, spp_tahunan_id = ?, diubah_pada = NOW() WHERE id = ?`,
        [
          d.nama,
          d.kelas_id,
          d.spp_bulanan_id,
          d.spp_pengembangan_id,
          d.spp_tahunan_id,
          id,
        ],
      );

      if (ditambah("pengembangan"))
        await tambahTagihanPengembangan(conn, id, spp.pengembangan);
      if (diganti("pengembangan")) {
        await conn.query(
          "UPDATE tagihan SET nominal = ?, spp_id = ? WHERE siswa_id = ? AND jenis = 'pengembangan'",
          [spp.pengembangan.biaya, spp.pengembangan.id, id],
        );
      }

      // Jenis bulanan/tahunan yang baru ditambahkan diterbitkan sejak bulan mulai tagih siswa.
      if (s.status === "aktif") await sinkronTagihan(conn, { siswaId: id });

      // Golongan baru hanya berlaku mulai bulan yang dipilih; tagihan sebelumnya tetap.
      if (diganti("bulanan")) {
        await conn.query(
          "UPDATE tagihan SET nominal = ?, spp_id = ? WHERE siswa_id = ? AND jenis = 'bulanan' AND bulan >= ? AND dihapus_pada IS NULL",
          [spp.bulanan.biaya, spp.bulanan.id, id, d.berlaku_mulai_bulan],
        );
      }
      if (diganti("tahunan")) {
        await conn.query(
          "UPDATE tagihan SET nominal = ?, spp_id = ? WHERE siswa_id = ? AND jenis = 'tahunan' AND bulan >= ? AND dihapus_pada IS NULL",
          [
            spp.tahunan.biaya,
            spp.tahunan.id,
            id,
            awalTahunAjaran(
              d.berlaku_mulai_bulan,
              config.bulanMulaiTahunAjaran,
            ),
          ],
        );
      }

      // Pengembangan dan tahunan tidak boleh lebih bayar: golongan baru tidak boleh lebih kecil dari yang sudah dibayar.
      const sesudah = await ringkasanSiswa(conn, id);
      for (const j of ["pengembangan", "tahunan"]) {
        if (sesudah[j].total_dibayar > sesudah[j].total_tagihan)
          throw validasi(
            `Golongan ${j} baru lebih kecil dari yang sudah dibayar siswa.`,
          );
      }
      return ambilSiswa(conn, id);
    });
    res.json(hasil);
  }),
);

// ---------- Status: lulus menghentikan tagihan berikutnya ----------
router.patch(
  "/:id/status",
  wrap(async (req, res) => {
    const id = idSkema.parse(req.params.id);
    const { status } = z
      .object({ status: z.enum(["aktif", "lulus"]) })
      .parse(req.body);
    const hasil = await withTx(async (conn) => {
      if (!(await ambilSiswa(conn, id, true)))
        throw tidakDitemukan("Siswa tidak ditemukan.");
      await conn.query(
        "UPDATE siswa SET status = ?, diubah_pada = NOW() WHERE id = ?",
        [status, id],
      );
      // Jika diaktifkan kembali, tagihan yang terlewat ikut diterbitkan (idempotent).
      if (status === "aktif") await sinkronTagihan(conn, { siswaId: id });
      return ambilSiswa(conn, id);
    });
    res.json(hasil);
  }),
);

router.delete(
  "/:id",
  wrap(async (req, res) => {
    const id = idSkema.parse(req.params.id);
    if (!(await ambilSiswa(pool, id)))
      throw tidakDitemukan("Siswa tidak ditemukan.");
    await pool.query("UPDATE siswa SET dihapus_pada = NOW() WHERE id = ?", [
      id,
    ]);
    res.status(204).end();
  }),
);

export default router;
