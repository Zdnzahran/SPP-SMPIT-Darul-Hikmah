// Semua perhitungan tanggal memakai zona waktu WIB (Asia/Jakarta), bukan zona waktu server.
const ZONA = "Asia/Jakarta";
const formatTanggal = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 'YYYY-MM-DD' hari ini di WIB */
export const hariIni = () => formatTanggal.format(new Date());

/** 'YYYY-MM-01' bulan berjalan di WIB */
export const bulanBerjalan = () => hariIni().slice(0, 7) + "-01";

/** 'YYYY-MM-DD HH:mm' sekarang di WIB */
export const sekarangWib = () =>
  new Date().toLocaleString("sv-SE", { timeZone: ZONA }).slice(0, 16);

export function tanggalValid(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Geser 'YYYY-MM-01' sebanyak n bulan (boleh negatif). */
export function tambahBulan(bulan, n) {
  const [y, m] = bulan.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** Daftar 'YYYY-MM-01' dari `dari` sampai `sampai` (inklusif). */
export function daftarBulan(dari, sampai) {
  const hasil = [];
  for (let b = dari; b <= sampai; b = tambahBulan(b, 1)) hasil.push(b);
  return hasil;
}

/** Awal tahun ajaran yang memuat `bulan`. Contoh (mulai Juli): 2026-10-01 -> 2026-07-01, 2026-03-01 -> 2025-07-01. */
export function awalTahunAjaran(bulan, bulanMulai = 7) {
  const y = Number(bulan.slice(0, 4));
  const m = Number(bulan.slice(5, 7));
  return `${m >= bulanMulai ? y : y - 1}-${String(bulanMulai).padStart(2, "0")}-01`;
}

/** Daftar awal tahun ajaran dari yang memuat `dari` sampai yang memuat `sampai`. */
export function daftarTahunAjaran(dari, sampai, bulanMulai = 7) {
  const hasil = [];
  const akhir = awalTahunAjaran(sampai, bulanMulai);
  for (
    let t = awalTahunAjaran(dari, bulanMulai);
    t <= akhir;
    t = tambahBulan(t, 12)
  )
    hasil.push(t);
  return hasil;
}
