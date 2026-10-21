import { hitungBulanan, hitungPengembangan, hitungTahunan } from "./hitung.js";
import { validasi } from "./errors.js";
import { config } from "./config.js";

const rp = (n) => "Rp " + n.toLocaleString("id-ID");
const tanpaRincian = ({ rincian, ...sisa }) => sisa;

/** Ringkasan tanpa daftar rincian per bulan / tahun (untuk daftar dan respons ringkas). */
export const ringkasanTanpaRincian = (r) => ({
  bulanan: tanpaRincian(r.bulanan),
  pengembangan: r.pengembangan,
  tahunan: tanpaRincian(r.tahunan),
  total_sisa: r.total_sisa,
});

/**
 * Menghitung sisa tagihan dan saldo banyak siswa sekaligus dari tabel tagihan + pembayaran.
 * Siswa yang tidak ditagih suatu jenis otomatis bernilai 0 untuk jenis itu.
 * kecualiPembayaranId: abaikan satu pembayaran (dipakai saat memvalidasi perubahan pembayaran itu).
 */
export async function ringkasanBanyak(
  conn,
  ids,
  { kecualiPembayaranId = null, denganRincian = false } = {},
) {
  const hasil = new Map();
  if (!ids.length) return hasil;

  const [tagihan] = await conn.query(
    "SELECT siswa_id, jenis, bulan, nominal FROM tagihan WHERE dihapus_pada IS NULL AND siswa_id IN (?) ORDER BY bulan",
    [ids],
  );
  const [bayar] = await conn.query(
    `SELECT siswa_id, jenis, SUM(nominal) AS total FROM pembayaran
      WHERE dihapus_pada IS NULL AND siswa_id IN (?) ${kecualiPembayaranId ? "AND id <> ?" : ""}
      GROUP BY siswa_id, jenis`,
    kecualiPembayaranId ? [ids, kecualiPembayaranId] : [ids],
  );

  const data = new Map(
    ids.map((id) => [
      id,
      {
        bulanan: [],
        tahunan: [],
        pengembangan: 0,
        dibayar: { bulanan: 0, tahunan: 0, pengembangan: 0 },
      },
    ]),
  );
  for (const t of tagihan) {
    const d = data.get(t.siswa_id);
    const nominal = Number(t.nominal);
    if (t.jenis === "pengembangan") d.pengembangan += nominal;
    else d[t.jenis].push({ bulan: t.bulan, nominal });
  }
  for (const b of bayar)
    data.get(b.siswa_id).dibayar[b.jenis] = Number(b.total);

  for (const [id, d] of data) {
    const bulanan = hitungBulanan(d.bulanan, d.dibayar.bulanan);
    const tahunan = hitungTahunan(d.tahunan, d.dibayar.tahunan);
    const pengembangan = hitungPengembangan(
      d.pengembangan,
      d.dibayar.pengembangan,
    );
    if (!denganRincian) {
      delete bulanan.rincian;
      delete tahunan.rincian;
    }
    hasil.set(id, {
      bulanan,
      pengembangan,
      tahunan,
      total_sisa: bulanan.sisa + pengembangan.sisa + tahunan.sisa,
    });
  }
  return hasil;
}

export async function ringkasanSiswa(conn, id, opsi = {}) {
  const peta = await ringkasanBanyak(conn, [id], {
    ...opsi,
    denganRincian: true,
  });
  return peta.get(id);
}

/** Memastikan nominal pembayaran tidak melewati batas. Melempar error validasi jika melewati. */
export function cekBatasPembayaran(ringkasan, jenis, nominal, biayaBulanan) {
  if (jenis !== "bulanan") {
    // Pengembangan dan tahunan tidak boleh lebih bayar.
    const sisa = ringkasan[jenis].sisa;
    if (nominal > sisa)
      throw validasi(`Nominal melebihi sisa tagihan ${jenis} (${rp(sisa)}).`);
    return;
  }
  const batas = config.batasBayarDiMukaBulan;
  if (batas === null) return;
  // Saldo setelah bayar tidak boleh melebihi (batas x biaya bulanan).
  const maks = ringkasan.bulanan.selisih + batas * biayaBulanan;
  if (nominal > maks) {
    throw validasi(
      maks > 0
        ? `Nominal terlalu besar. Maksimal ${rp(maks)} (sisa tagihan ditambah bayar di muka ${batas} bulan).`
        : `Saldo lebih bayar sudah mencapai batas ${batas} bulan.`,
    );
  }
}
