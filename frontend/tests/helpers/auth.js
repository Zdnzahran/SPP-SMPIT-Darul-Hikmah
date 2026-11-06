import { expect } from "@playwright/test";

export async function loginAsBendahara(page) {
  await page.goto("/login");
  await page
    .locator('input[autocomplete="username"]')
    .fill(process.env.E2E_USERNAME || "bendahara_test");
  await page
    .locator('input[autocomplete="current-password"]')
    .fill(
      process.env.E2E_PASSWORD ||
        process.env.SEED_PASSWORD ||
        "password_test_bendahara",
    );

  const loginResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/login" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Masuk" }).click();

  const loginResponse = await loginResponsePromise;
  expect(
    loginResponse.status(),
    `API login mengembalikan ${loginResponse.status()}: ${await loginResponse.text()}`,
  ).toBe(200);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Keluar" })).toBeVisible();
}
