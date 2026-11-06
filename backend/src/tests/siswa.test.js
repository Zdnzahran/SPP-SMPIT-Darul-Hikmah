import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const envTestPath = fileURLToPath(new URL("../.env.test", import.meta.url));
const envTest = dotenv.config({ path: envTestPath, override: true });
if (envTest.error) {
  throw new Error(`Tidak dapat membaca konfigurasi test: ${envTestPath}`, {
    cause: envTest.error,
  });
}

const { buatApp } = await import("../app.js");
const { runTestSeed } = await import("./seed.test.js");
const { pool } = await import("../db.js");

test.describe("API Manajemen Siswa (/api/siswa)", () => {
  let server;
  let baseUrl;
  let authCookie;
  let masterIds;

  test.before(async () => {
    // 1. Pastikan data master seed tersedia di spp_test_db
    masterIds = await runTestSeed();

    // 2. Nyalakan server test di port acak
    await new Promise((resolve) => {
      server = buatApp().listen(0, () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // 3. Login untuk mengambil cookie sesi bendahara
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "bendahara_test",
        password: process.env.SEED_PASSWORD || "password_test_bendahara",
      }),
    });

    assert.equal(loginRes.status, 200, "Login setup harus berhasil");
    const setCookieHeader = loginRes.headers.get("set-cookie");
    assert.ok(setCookieHeader, "Harus mendapatkan cookie session");
    // Ambil bagian cookie utama sebelum tanda titik koma
    authCookie = setCookieHeader.split(";")[0];
  });

  test.after(async () => {
    try {
      if (server) {
        await new Promise((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve())),
        );
      }
    } finally {
      await pool.end();
    }
  });

  test("Gagal menambah siswa jika tidak memilih jenis SPP (Validasi Zod HTTP 400)", async () => {
    const payload = {
      nama: "Siswa Uji Tanpa SPP",
      kelas_id: masterIds.kelasId,
      bulan_mulai_tagih: "2024-07-01",
    };

    const res = await fetch(`${baseUrl}/api/siswa`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookie,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(
      res.status,
      400,
      "Harus ditolak dengan status 400 Bad Request",
    );
  });

  test("Berhasil menambah siswa baru dengan jenis bulanan dan tahunan (HTTP 201/200)", async () => {
    const payload = {
      nama: "Ahmad Siswa Test",
      kelas_id: masterIds.kelasId,
      spp_bulanan_id: masterIds.sppBulananId,
      spp_tahunan_id: masterIds.sppTahunanId,
      bulan_mulai_tagih: "2024-07-01",
    };

    const res = await fetch(`${baseUrl}/api/siswa`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookie,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201, "Penambahan siswa harus mengembalikan 201");

    const body = await res.json();
    assert.ok(body.id, "Respons harus mengembalikan ID siswa");
  });
});
