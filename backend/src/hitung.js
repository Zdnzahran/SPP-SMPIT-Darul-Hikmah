// Perhitungan murni (tanpa database) untuk sisa tagihan dan saldo.
// Prinsip: sisa dan saldo TIDAK disimpan, selalu dihitung dari total tagihan dikurangi total pembayaran.

/**
 * SPP bulanan.
 * @param {{bulan:string, nominal:number}[]} tagihan tagihan bulanan yang sudah terbit
 * @param {number} totalDibayar jumlah semua pembayaran bulanan
 *
 * selisih = total tagihan - total dibayar.
 *   selisih > 0  -> masih ada sisa tagihan
 *   selisih < 0  -> kelebihan bayar = saldo, otomatis menutup tagihan yang terbit berikutnya
 * Pembayaran menutup tagihan dari bulan paling lama ke terbaru (FIFO).
 */
export function hitungBulanan(tagihan, totalDibayar) {
  const urut = [...tagihan].sort((a, b) => a.bulan.localeCompare(b.bulan));
  const totalTagihan = urut.reduce((n, t) => n + t.nominal, 0);
  const selisih = totalTagihan - totalDibayar;

  let uang = totalDibayar;
  let tunggakanSejak = null;
  let jumlahMenunggak = 0;
  const rincian = urut.map((t) => {
    const terbayar = Math.min(t.nominal, uang);
    uang -= terbayar;
    const sisa = t.nominal - terbayar;
    if (sisa > 0) {
      jumlahMenunggak += 1;
      tunggakanSejak ??= t.bulan;
    }
    return { bulan: t.bulan, nominal: t.nominal, terbayar, sisa };
  });

  return {
    total_tagihan: totalTagihan,
    total_dibayar: totalDibayar,
    selisih,
    sisa: Math.max(selisih, 0),
    saldo: Math.max(-selisih, 0),
    lunas: selisih <= 0,
    tunggakan_sejak: tunggakanSejak,
    jumlah_bulan_menunggak: jumlahMenunggak,
    rincian,
  };
}

/** SPP pengembangan: tagihan tunggal, tidak boleh lebih bayar. */
export function hitungPengembangan(totalTagihan, totalDibayar) {
  const selisih = totalTagihan - totalDibayar;
  return {
    total_tagihan: totalTagihan,
    total_dibayar: totalDibayar,
    sisa: Math.max(selisih, 0),
    lunas: selisih <= 0,
  };
}

/**
 * SPP tahunan: satu tagihan per tahun ajaran (kunci `bulan` = awal tahun ajaran).
 * Dialokasikan dari tahun ajaran terlama (FIFO), seperti bulanan. Aplikasi tidak mengizinkan lebih bayar,
 * jadi saldo selalu 0.
 */
export const hitungTahunan = hitungBulanan;
