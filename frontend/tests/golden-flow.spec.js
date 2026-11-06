import { test, expect } from "@playwright/test";
import { loginAsBendahara } from "./helpers/auth.js";

test("Golden flow bendahara: tambah siswa, catat pembayaran, dan pastikan lunas", async ({
  page,
}) => {
  const namaSiswa = `Siswa E2E ${Date.now()}`;

  await loginAsBendahara(page);
  await page.getByRole("link", { name: "Siswa", exact: true }).click();
  await page.getByRole("button", { name: "Tambah siswa" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nama siswa").fill(namaSiswa);
  await dialog.getByLabel("Kelas", { exact: true }).selectOption({
    label: "Kelas 7A Test",
  });
  await dialog.getByLabel("Golongan SPP bulanan").selectOption({
    label: "SPP Bulanan Standar Test (Rp 300.000)",
  });
  await dialog.locator('input[type="month"]').fill("2024-07");
  const createStudentResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/siswa" &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Simpan siswa" }).click();

  const createStudentResponse = await createStudentResponsePromise;
  expect(createStudentResponse.status()).toBe(201);
  const siswa = await createStudentResponse.json();
  expect(siswa.bulan_mulai_tagih).toBe("2024-07-01");

  await page.getByRole("link", { name: "Pembayaran", exact: true }).click();
  await page
    .getByPlaceholder("Ketik minimal 2 huruf nama siswa")
    .fill(namaSiswa);
  await page
    .locator(".list-group-item-action")
    .filter({ hasText: namaSiswa })
    .click();

  await page.getByRole("button", { name: "Lunasi sisa" }).click();
  await page.getByRole("button", { name: "Simpan pembayaran" }).click();
  await expect(page.getByRole("alert")).toContainText("tersimpan");

  await page.getByRole("link", { name: "Siswa", exact: true }).click();
  await page.getByPlaceholder("Nama siswa").fill(namaSiswa);
  await page.getByRole("link", { name: namaSiswa }).click();
  await expect(
    page.getByText("Lunas sampai bulan berjalan", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Lunas", { exact: true }).first()).toBeVisible();
});
