import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(status, kode, pesan, detail = []) {
    super(pesan);
    this.status = status;
    this.kode = kode;
    this.detail = detail;
  }
}
export const validasi = (pesan, detail = []) => new AppError(400, 'VALIDASI_GAGAL', pesan, detail);
export const tidakDitemukan = (pesan = 'Data tidak ditemukan.') => new AppError(404, 'TIDAK_DITEMUKAN', pesan);
export const konflik = (pesan) => new AppError(409, 'KONFLIK', pesan);

/** Membungkus handler async agar error masuk ke penangan error Express. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function penanganError(err, req, res, _next) {
  let status = 500;
  let error = { kode: 'KESALAHAN_SERVER', pesan: 'Terjadi kesalahan pada server.', detail: [] };

  if (err instanceof AppError) {
    status = err.status;
    error = { kode: err.kode, pesan: err.message, detail: err.detail };
  } else if (err instanceof ZodError) {
    status = 400;
    const detail = err.issues.map((i) => ({ field: i.path.join('.'), pesan: i.message }));
    error = { kode: 'VALIDASI_GAGAL', pesan: detail[0]?.pesan || 'Data tidak valid.', detail };
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    error = { kode: 'VALIDASI_GAGAL', pesan: 'Format JSON tidak valid.', detail: [] };
  } else if (err.code === 'ER_DUP_ENTRY') {
    status = 409;
    error = { kode: 'DUPLIKAT', pesan: 'Data dengan nama yang sama sudah ada.', detail: [] };
  } else {
    console.error(err);
  }
  res.status(status).json({ error });
}
