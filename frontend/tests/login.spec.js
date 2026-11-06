import { test, expect } from "@playwright/test";
import { loginAsBendahara } from "./helpers/auth.js";

test.describe("Alur Autentikasi Bendahara (E2E)", () => {
  test("Pengguna tidak dikenal diarahkan kembali ke halaman login saat akses dashboard", async ({
    page,
  }) => {
    await page.goto("/siswa");

    await expect(page).toHaveURL(/\/login$/);
  });

  test("Bendahara berhasil masuk dengan kredensial yang tepat", async ({
    page,
  }) => {
    await loginAsBendahara(page);
  });
});
