// Semua pengaturan dibaca dari file .env
import "dotenv/config";

function angkaAtauNull(nilai, bawaan) {
  if (nilai === undefined) return bawaan;
  const t = nilai.trim().toLowerCase();
  return t === "" || t === "null" ? null : parseInt(t, 10);
}

export const config = {
  port: Number(process.env.PORT || 4000),
  production: process.env.NODE_ENV === "production",
  databaseUrl: process.env.DATABASE_URL,
  // TiDB Cloud dan database online lain mewajibkan koneksi TLS. Isi DB_SSL=true untuk mengaktifkannya.
  dbSsl: process.env.DB_SSL === "true",
  rahasia: process.env.SESSION_SECRET,
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production",
  namaSekolah: "SMPIT Darul Hikmah",
  // SPP bulanan ditagih setahun penuh, jadi bawaannya tidak ada bulan yang dikecualikan.
  bulanDikecualikan: (process.env.BULAN_DIKECUALIKAN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number),
  // Bulan (1-12) dimulainya tahun ajaran baru; SPP tahunan terbit pada bulan ini. 7 = Juli.
  bulanMulaiTahunAjaran: Number(process.env.BULAN_MULAI_TAHUN_AJARAN || 7),
  // Batas saldo lebih bayar (kelipatan biaya bulanan). null = tanpa batas.
  batasBayarDiMukaBulan: angkaAtauNull(
    process.env.BATAS_BAYAR_DI_MUKA_BULAN,
    12,
  ),
};

if (
  !(config.bulanMulaiTahunAjaran >= 1 && config.bulanMulaiTahunAjaran <= 12)
) {
  console.error("BULAN_MULAI_TAHUN_AJARAN harus angka 1 sampai 12.");
  process.exit(1);
}

for (const kunci of ["databaseUrl", "rahasia"]) {
  if (!config[kunci]) {
    console.error(
      `Pengaturan ${kunci === "databaseUrl" ? "DATABASE_URL" : "SESSION_SECRET"} belum diisi di file .env`,
    );
    process.exit(1);
  }
}
