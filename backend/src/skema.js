// Potongan skema validasi (zod) yang dipakai bersama.
import { z } from "zod";
import { tanggalValid } from "./tanggal.js";

export const idSkema = z.coerce.number().int().positive();
export const tanggalSkema = z
  .string()
  .refine(tanggalValid, "Tanggal harus berformat YYYY-MM-DD dan valid.");
export const bulanSkema = z
  .string()
  .refine(
    (s) => /^\d{4}-\d{2}-01$/.test(s) && tanggalValid(s),
    "Bulan harus berformat YYYY-MM-01.",
  );
export const jenisSkema = z.enum(["bulanan", "pengembangan", "tahunan"]);
export const rupiahSkema = z
  .number({ invalid_type_error: "Nominal harus berupa angka." })
  .int("Nominal harus bilangan bulat.");

/** Parameter query boolean ('true'/'false'/'1'/'0') dengan nilai bawaan. */
export const boolQuery = (bawaan) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? bawaan : v === "true" || v === "1"));
