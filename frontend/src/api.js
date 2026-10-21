export class ApiError extends Error {
  constructor(pesan, status, detail) {
    super(pesan);
    this.status = status;
    this.detail = detail;
  }
}

/** Semua permintaan ke backend lewat sini. Mengembalikan JSON, atau null untuk 204. */
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.', 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error?.pesan || 'Terjadi kesalahan.', res.status, data?.error?.detail);
  return data;
}
