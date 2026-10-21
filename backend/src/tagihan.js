import { pool } from "./db.js";
import { config } from "./config.js";
import {
  bulanBerjalan,
  daftarBulan,
  daftarTahunAjaran,
  tambahBulan,
} from "./tanggal.js";

/**
 * Menerbitkan tagihan yang belum ada untuk siswa aktif:
 *  - bulanan : satu per bulan, dari bulan_mulai_tagih sampai bulan berjalan (hanya siswa yang punya SPP bulanan)
 *  - tahunan : satu per tahun ajaran (terbit awal tahun ajaran, mis. 1 Juli) dari tahun ajaran siswa mulai ditagih
 *              sampai tahun ajaran berjalan (hanya siswa yang punya SPP tahunan). Siswa yang masuk tengah tahun
 *              ajaran langsung ditagih tahunan penuh pada bulan masuknya.
 * Aman dijalankan berulang (idempotent): hanya membuat yang belum ada, dan UNIQUE di database mencegah ganda.
 * Siswa berstatus 'lulus' tidak ditagih lagi.
 *
 * Dipanggil oleh: cron tanggal 1, saat server menyala, saat bendahara login, dan POST /tagihan/sinkron.
 */
export async function sinkronTagihan(conn = pool, { siswaId = null } = {}) {
  const sekarang = bulanBerjalan();
  const filter = siswaId ? " AND s.id = ?" : "";
  const param = siswaId ? [siswaId] : [];
  const terdampak = new Set();
  const bulanDiproses = [];
  let dibuat = 0;

  async function terbitkan(jenis, bulan, belum) {
    const baris = belum.map((r) => [
      r.siswa_id,
      jenis,
      bulan,
      r.biaya,
      r.spp_id,
    ]);
    const [ins] = await conn.query(
      `INSERT IGNORE INTO tagihan (siswa_id, jenis, bulan, nominal, spp_id, dibuat_pada) VALUES ${baris.map(() => "(?, ?, ?, ?, ?, NOW())").join(", ")}`,
      baris.flat(),
    );
    if (ins.affectedRows > 0) {
      dibuat += ins.affectedRows;
      bulanDiproses.push(bulan);
      belum.forEach((r) => terdampak.add(r.siswa_id));
    }
  }

  const awalPertama = async (kolom) => {
    const [[{ awal }]] = await conn.query(
      `SELECT MIN(s.bulan_mulai_tagih) AS awal FROM siswa s WHERE s.status = 'aktif' AND s.dihapus_pada IS NULL AND s.${kolom} IS NOT NULL${filter}`,
      param,
    );
    return awal;
  };

  // ---- Bulanan ----
  const awalBulanan = await awalPertama("spp_bulanan_id");
  if (awalBulanan) {
    const ditagih = daftarBulan(awalBulanan, sekarang).filter(
      (b) => !config.bulanDikecualikan.includes(Number(b.slice(5, 7))),
    );
    for (const bulan of ditagih) {
      const [belum] = await conn.query(
        `SELECT s.id AS siswa_id, p.id AS spp_id, p.biaya
           FROM siswa s JOIN spp p ON p.id = s.spp_bulanan_id
          WHERE s.status = 'aktif' AND s.dihapus_pada IS NULL AND s.bulan_mulai_tagih <= ?${filter}
            AND NOT EXISTS (SELECT 1 FROM tagihan t WHERE t.siswa_id = s.id AND t.jenis = 'bulanan' AND t.bulan = ?)`,
        [bulan, ...param, bulan],
      );
      if (belum.length) await terbitkan("bulanan", bulan, belum);
    }
  }

  // ---- Tahunan ----
  const awalTahunan = await awalPertama("spp_tahunan_id");
  if (awalTahunan) {
    for (const ta of daftarTahunAjaran(
      awalTahunan,
      sekarang,
      config.bulanMulaiTahunAjaran,
    )) {
      const [belum] = await conn.query(
        `SELECT s.id AS siswa_id, p.id AS spp_id, p.biaya
           FROM siswa s JOIN spp p ON p.id = s.spp_tahunan_id
          WHERE s.status = 'aktif' AND s.dihapus_pada IS NULL
            AND s.bulan_mulai_tagih <= ? AND s.bulan_mulai_tagih < ?${filter}
            AND NOT EXISTS (SELECT 1 FROM tagihan t WHERE t.siswa_id = s.id AND t.jenis = 'tahunan' AND t.bulan = ?)`,
        [sekarang, tambahBulan(ta, 12), ...param, ta],
      );
      if (belum.length) await terbitkan("tahunan", ta, belum);
    }
  }

  return {
    dibuat,
    siswa_terdampak: terdampak.size,
    bulan_diproses: bulanDiproses,
  };
}
