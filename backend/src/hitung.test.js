import test from "node:test";
import assert from "node:assert/strict";
import { hitungBulanan, hitungPengembangan, hitungTahunan } from "./hitung.js";
import {
  tambahBulan,
  daftarBulan,
  tanggalValid,
  awalTahunAjaran,
  daftarTahunAjaran,
} from "./tanggal.js";

const bln = (...b) => b.map((bulan) => ({ bulan, nominal: 100000 }));

test("bayar 400rb saat 3 tagihan terbit: sisa 0, saldo 100rb", () => {
  const r = hitungBulanan(
    bln("2026-07-01", "2026-08-01", "2026-09-01"),
    400000,
  );
  assert.equal(r.sisa, 0);
  assert.equal(r.saldo, 100000);
  assert.equal(r.lunas, true);
  assert.equal(r.tunggakan_sejak, null);
});

test("saldo otomatis memotong tagihan baru yang terbit tanggal 1", () => {
  const r = hitungBulanan(
    bln("2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"),
    400000,
  );
  assert.equal(r.sisa, 0);
  assert.equal(r.saldo, 0);
});

test("bayar setahun di muka: saldo menutup 12 bulan berikutnya satu per satu", () => {
  // bulan pertama terbit (100rb), orang tua bayar 1.200.000
  let r = hitungBulanan(bln("2026-07-01"), 1200000);
  assert.equal(r.saldo, 1100000);
  r = hitungBulanan(bln("2026-07-01", "2026-08-01", "2026-09-01"), 1200000);
  assert.equal(r.saldo, 900000);
  assert.equal(r.sisa, 0);
});

test("cicilan: FIFO menutup bulan terlama dulu", () => {
  const r = hitungBulanan(
    bln("2026-07-01", "2026-08-01", "2026-09-01"),
    150000,
  );
  assert.equal(r.sisa, 150000);
  assert.equal(r.tunggakan_sejak, "2026-08-01");
  assert.equal(r.jumlah_bulan_menunggak, 2);
  assert.deepEqual(
    r.rincian.map((x) => x.terbayar),
    [100000, 50000, 0],
  );
});

test("belum ada tagihan dan belum bayar: lunas, tanpa tunggakan", () => {
  const r = hitungBulanan([], 0);
  assert.equal(r.sisa, 0);
  assert.equal(r.tunggakan_sejak, null);
});

test("pengembangan tidak punya saldo", () => {
  const r = hitungPengembangan(3000000, 1000000);
  assert.equal(r.sisa, 2000000);
  assert.equal(r.lunas, false);
  assert.equal("saldo" in r, false);
});

test("tanggal: pergantian tahun dan daftar bulan", () => {
  assert.equal(tambahBulan("2026-12-01", 1), "2027-01-01");
  assert.equal(tambahBulan("2026-01-01", -1), "2025-12-01");
  assert.deepEqual(daftarBulan("2026-11-01", "2027-02-01"), [
    "2026-11-01",
    "2026-12-01",
    "2027-01-01",
    "2027-02-01",
  ]);
  assert.equal(tanggalValid("2026-02-30"), false);
  assert.equal(tanggalValid("2026-02-28"), true);
});

test("tahun ajaran mulai Juli: bulan Jan-Jun masuk tahun ajaran sebelumnya", () => {
  assert.equal(awalTahunAjaran("2026-07-01"), "2026-07-01");
  assert.equal(awalTahunAjaran("2026-10-01"), "2026-07-01");
  assert.equal(awalTahunAjaran("2027-06-01"), "2026-07-01");
  assert.equal(awalTahunAjaran("2027-01-01"), "2026-07-01");
  assert.deepEqual(daftarTahunAjaran("2024-09-01", "2026-10-01"), [
    "2024-07-01",
    "2025-07-01",
    "2026-07-01",
  ]);
});

test("tahunan: cicilan menutup tahun ajaran terlama dulu", () => {
  const t = [
    { bulan: "2025-07-01", nominal: 1000000 },
    { bulan: "2026-07-01", nominal: 1000000 },
  ];
  const r = hitungTahunan(t, 1500000);
  assert.equal(r.sisa, 500000);
  assert.equal(r.tunggakan_sejak, "2026-07-01");
  assert.equal(r.jumlah_bulan_menunggak, 1);
});
