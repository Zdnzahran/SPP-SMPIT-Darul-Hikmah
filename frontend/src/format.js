export const rupiah = (n) =>
  "Rp " + new Intl.NumberFormat("id-ID").format(n ?? 0);

const BULAN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];
/** '2026-10-01' -> 'Okt 2026' */
export const bulanLabel = (b) =>
  b ? `${BULAN[Number(b.slice(5, 7)) - 1]} ${b.slice(0, 4)}` : "-";
/** '2026-10-18' -> '18 Okt 2026' */
export const tanggalLabel = (t) =>
  t
    ? `${Number(t.slice(8, 10))} ${BULAN[Number(t.slice(5, 7)) - 1]} ${t.slice(0, 4)}`
    : "-";

const fHari = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });
export const hariIni = () => fHari.format(new Date()); // YYYY-MM-DD (WIB)
export const bulanIni = () => hariIni().slice(0, 7); // YYYY-MM (WIB)

export const JENIS = ["bulanan", "pengembangan", "tahunan"];
export const NAMA_JENIS = {
  bulanan: "Bulanan",
  pengembangan: "Pengembangan",
  tahunan: "Tahunan",
};
/** Awal tahun ajaran '2026-07-01' -> '2026/2027' */
export const tahunAjaranLabel = (b) =>
  b ? `${b.slice(0, 4)}/${Number(b.slice(0, 4)) + 1}` : "-";
