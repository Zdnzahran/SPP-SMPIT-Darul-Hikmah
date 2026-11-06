import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// 1. Pastikan env test dimuat
const envTestPath = fileURLToPath(new URL("../../.env.test", import.meta.url));
const envTest = dotenv.config({ path: envTestPath, override: true });
if (envTest.error) {
  throw new Error(`Tidak dapat membaca konfigurasi test: ${envTestPath}`, {
    cause: envTest.error,
  });
}

const { buatApp } = await import("../app.js");

test.describe("API Autentikasi Bendahara (/api/auth)", () => {
  let server;
  let baseUrl;

  // Jalankan server test di port dinamis (port 0)
  test.before(async () => {
    await new Promise((resolve) => {
      server = buatApp().listen(0, () => {
        const address = server.address();
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  // Matikan server setelah semua test selesai
  test.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  test("Gagal login dengan password salah (HTTP 401)", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "bendahara_test",
        password: "password_yang_salah_123",
      }),
    });

    assert.equal(res.status, 401, "Status respons harus 401 Unauthorized");
  });

  test("Gagal mengakses data siswa tanpa login (HTTP 401)", async () => {
    const res = await fetch(`${baseUrl}/api/siswa`);

    assert.equal(res.status, 401, "Akses tanpa login harus ditolak");
    const body = await res.json();
    assert.equal(body.error.kode, "BELUM_LOGIN");
  });

  test("Berhasil login dengan akun seed dan menerima cookie JWT httpOnly", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "bendahara_test",
        password: process.env.SEED_PASSWORD || "password_test_bendahara",
      }),
    });

    assert.equal(res.status, 200, "Status respons harus 200 OK");

    // Verifikasi keberadaan cookie JWT
    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie, "Header Set-Cookie harus dikembalikan");
    assert.match(
      setCookie,
      /HttpOnly/i,
      "Cookie sesi harus berkarakteristik HttpOnly",
    );
  });
});
