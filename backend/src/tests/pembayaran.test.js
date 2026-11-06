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

test.describe("API Pembayaran SPP (/api/pembayaran)", () => {
  let server;
  let baseUrl;
  let authCookie;
  let masterIds;
  let siswaId;

  test.before(async () => {
    masterIds = await runTestSeed();

    await new Promise((resolve) => {
      server = buatApp().listen(0, () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // 1. Login bendahara
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
    authCookie = setCookieHeader.split(";")[0];

    // 2. Siapkan 1 siswa uji khusus alur pembayaran
    const siswaRes = await fetch(`${baseUrl}/api/siswa`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookie,
      },
      body: JSON.stringify({
        nama: "Siswa Uji Pembayaran",
        kelas_id: masterIds.kelasId,
        spp_bulanan_id: masterIds.sppBulananId,
        bulan_mulai_tagih: "2024-07-01",
      }),
    });
    assert.equal(
      siswaRes.status,
      201,
      "Siswa uji pembayaran harus berhasil dibuat",
    );
    const siswaBody = await siswaRes.json();
    siswaId = siswaBody.id;
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

  test("Gagal mencatat pembayaran jika nominal 0 atau negatif (HTTP 400)", async () => {
    const payload = {
      siswa_id: siswaId,
      jenis: "bulanan",
      nominal: 0,
      tanggal: "2024-07-15",
    };

    const res = await fetch(`${baseUrl}/api/pembayaran`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookie,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400, "Nominal 0 harus ditolak dengan status 400");
  });

  test("Gagal mencatat pembayaran jika tanggal berada di masa depan (HTTP 400)", async () => {
    const payload = {
      siswa_id: siswaId,
      jenis: "bulanan",
      nominal: 300000,
      tanggal: "2099-01-01",
    };

    const res = await fetch(`${baseUrl}/api/pembayaran`, {
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
      "Tanggal masa depan harus ditolak dengan status 400",
    );
  });

  test("Berhasil mencatat pembayaran bulanan yang valid (HTTP 201)", async () => {
    const payload = {
      siswa_id: siswaId,
      jenis: "bulanan",
      nominal: 300000,
      tanggal: "2024-07-15",
    };

    const res = await fetch(`${baseUrl}/api/pembayaran`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookie,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(
      res.status,
      201,
      "Pembayaran valid harus mengembalikan status 201",
    );
    const body = await res.json();
    assert.ok(
      body.pembayaran?.id,
      "Respons harus mengembalikan ID transaksi pembayaran",
    );
  });
});
