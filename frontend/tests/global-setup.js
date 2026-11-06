import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(
  new URL("../../backend/package.json", import.meta.url),
);
const dotenv = require("dotenv");
const envTestPath = fileURLToPath(
  new URL("../../backend/.env.test", import.meta.url),
);
const envTest = dotenv.config({ path: envTestPath, override: true });
if (envTest.error) {
  throw new Error(`Tidak dapat membaca konfigurasi test: ${envTestPath}`, {
    cause: envTest.error,
  });
}

process.env.E2E_USERNAME ||= "bendahara_test";
process.env.E2E_PASSWORD ||=
  process.env.SEED_PASSWORD || "password_test_bendahara";
if (!process.env.DATABASE_URL) {
  throw new Error(`DATABASE_URL belum diatur di ${envTestPath}`);
}

const databaseUrl = new URL(process.env.DATABASE_URL);
if (decodeURIComponent(databaseUrl.pathname.slice(1)) !== "spp_test_db") {
  throw new Error(
    `Playwright hanya boleh berjalan pada database spp_test_db, bukan "${databaseUrl.pathname.slice(1)}".`,
  );
}

await import("../../backend/src/initDb.js");
const { runTestSeed } = await import("../../backend/src/seed.test.js");

export default async function globalSetup() {
  await runTestSeed();
}
