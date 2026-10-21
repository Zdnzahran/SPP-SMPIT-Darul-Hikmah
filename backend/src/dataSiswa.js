const SELECT_SISWA = `
  SELECT s.id, s.nama, s.status, s.kelas_id, k.nama AS kelas,
         s.spp_bulanan_id, pb.nama AS spp_bulanan, pb.biaya AS biaya_bulanan,
         s.spp_pengembangan_id, pp.nama AS spp_pengembangan, pp.biaya AS biaya_pengembangan,
         s.spp_tahunan_id, pt.nama AS spp_tahunan, pt.biaya AS biaya_tahunan,
         s.bulan_mulai_tagih
    FROM siswa s
    JOIN kelas k ON k.id = s.kelas_id
    LEFT JOIN spp pb ON pb.id = s.spp_bulanan_id
    LEFT JOIN spp pp ON pp.id = s.spp_pengembangan_id
    LEFT JOIN spp pt ON pt.id = s.spp_tahunan_id`;

/** Satu siswa yang belum dihapus (atau null). kunci=true mengunci barisnya di dalam transaksi. */
export async function ambilSiswa(conn, id, kunci = false) {
  const [rows] = await conn.query(
    `${SELECT_SISWA} WHERE s.id = ? AND s.dihapus_pada IS NULL${kunci ? " FOR UPDATE" : ""}`,
    [id],
  );
  return rows[0] ?? null;
}

export async function cariSiswa(conn, { kelas_id, status, q, siswa_id } = {}) {
  const where = ["s.dihapus_pada IS NULL"];
  const p = [];
  if (siswa_id) {
    where.push("s.id = ?");
    p.push(siswa_id);
  }
  if (kelas_id) {
    where.push("s.kelas_id = ?");
    p.push(kelas_id);
  }
  if (status && status !== "semua") {
    where.push("s.status = ?");
    p.push(status);
  }
  if (q) {
    where.push("s.nama LIKE ?");
    p.push(`%${q}%`);
  }
  const [rows] = await conn.query(
    `${SELECT_SISWA} WHERE ${where.join(" AND ")} ORDER BY k.nama, s.nama`,
    p,
  );
  return rows;
}
