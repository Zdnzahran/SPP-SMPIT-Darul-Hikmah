# Sistem Rekap SPP SMPIT Darul Hikmah

Aplikasi untuk bendahara: kelola kelas dan siswa, catat pembayaran SPP, dan cetak sisa tagihan.
Dibuat dari `sistem-rekap-spp-blueprint.json` (v2.0). Stack: React (Vite) + Node.js/Express + MySQL/MariaDB.

## Aturan yang dijalankan sistem

- **Jenis SPP dipilih bebas per siswa**: ada tiga jenis (bulanan, pengembangan, tahunan). Saat menambah siswa, centang jenis yang ditagihkan: hanya bulanan, bulanan + pengembangan, atau ketiganya. Minimal satu jenis.
- **SPP bulanan ditagih setahun penuh** (12 bulan, tidak ada bulan libur). Tagihan terbit otomatis setiap tanggal 1 pukul 00.05 WIB.
- **SPP tahunan** terbit sekali setiap awal tahun ajaran (1 Juli, bisa diubah lewat `BULAN_MULAI_TAHUN_AJARAN`) selama siswa aktif. Boleh dicicil, tidak boleh lebih bayar. Siswa yang masuk tengah tahun ajaran langsung ditagih tahunan penuh pada bulan masuknya. Cicilan menutup tahun ajaran terlama dulu.
- **Pembayaran** dicatat per jenis (bulanan, pengembangan, atau tahunan), boleh dicicil. Tidak ada angka sisa atau saldo yang disimpan; semuanya dihitung dari total tagihan dikurangi total pembayaran.
- **Bayar di muka / setahun penuh**: uang masuk ke `pembayaran`. Karena tagihan bulan depan belum terbit, hasil hitungnya negatif dan ditampilkan sebagai **saldo bulanan**. Begitu tagihan baru terbit tanggal 1, saldo itu otomatis memotongnya. Bendahara tidak perlu input ulang.
- **Siswa masuk tengah tahun / siswa lama**: isi "Mulai ditagih bulan" dan "Sudah dibayar" (saldo awal) di form tambah siswa.
- **Kelulusan**: tombol _Luluskan_ mengubah status siswa menjadi lulus. Tagihan bulanan berhenti terbit, riwayat dan sisanya tetap tersimpan dan bisa dicetak (pilih status "Lulus" atau "Semua").
- **Kenaikan kelas** manual: bendahara membuka _Edit_ siswa, mengganti kelas, lalu menyimpan.
- Pembayaran bulanan dialokasikan ke bulan terlama dulu (FIFO). Semua data memakai soft delete.

## Menjalankan di laptop (mode belajar)

Syarat: Node.js 18+ dan MySQL atau MariaDB yang sedang berjalan.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # lalu edit DATABASE_URL, SESSION_SECRET, SEED_PASSWORD
npm run db:init             # membuat database dan tabel
npm run seed                # akun "bendahara" + 4 golongan SPP bulanan
npm run dev                 # API di http://localhost:4000

# 2. Frontend (terminal kedua)
cd frontend
npm install
npm run dev                 # buka http://localhost:5173
```

Login dengan username `bendahara` dan password dari `SEED_PASSWORD`, lalu segera ganti lewat tombol _Ganti password_.

**Urutan mengisi data pertama kali**: Kelas, lalu SPP (golongan **pengembangan** dan **tahunan** diisi sendiri karena nominalnya belum diketahui), lalu Siswa, lalu Pembayaran.

## Memperbarui dari versi sebelumnya (database sudah berisi data)

1. Salin file backend dan frontend yang baru, lalu `npm install` di `backend` dan `frontend`.
2. Di folder `backend` jalankan **sekali**: `npm run db:migrasi`. Skrip ini hanya mengubah struktur tabel; siswa, tagihan, dan pembayaran yang ada tidak berubah. Aman dijalankan berulang.
3. Jalankan ulang backend dan frontend. (Opsional) tambahkan `BULAN_MULAI_TAHUN_AJARAN=7` di `.env`.

Instalasi baru tidak perlu migrasi; `npm run db:init` sudah memakai skema terbaru.

## Mengganti logo dan foto

Taruh file Anda di folder `frontend/public` dengan nama berikut, lalu refresh browser (saat produksi, jalankan `npm run build` lagi):

| File              | Dipakai di                                    | Ukuran saran                               |
| ----------------- | --------------------------------------------- | ------------------------------------------ |
| `logo.png`        | menu samping, halaman login, ikon tab browser | persegi, minimal 256x256, latar transparan |
| `foto-login.jpg`  | sisi kiri halaman login                       | potret, minimal 1000x1400                  |
| `foto-dasbor.jpg` | banner di atas dasbor                         | lanskap, minimal 1600x600                  |

Jika file tidak ada, aplikasi memakai `logo.svg` bawaan dan latar hijau polos. Foto otomatis diberi lapisan gelap agar tulisan putih tetap terbaca. Nama file, nama sekolah, dan tagline bisa diubah di `frontend/src/tampilan.js`.

## Produksi

```bash
cd frontend && npm run build        # menghasilkan frontend/dist
cd ../backend && NODE_ENV=production npm start
```

Express otomatis menyajikan `frontend/dist`, jadi cukup satu server. Wajib: HTTPS dan `COOKIE_SECURE=true`. Shared hosting PHP biasanya tidak mendukung Node, jadi butuh VPS atau PaaS. Lakukan **backup database berkala** karena ini data keuangan.

## Pengujian

```bash
cd backend && npm test      # uji perhitungan sisa, saldo, FIFO, dan tanggal
```

## Struktur

```
backend/schema.sql        skema database
backend/src/hitung.js     rumus sisa / saldo / FIFO (murni, ada tes)
backend/src/tagihan.js    mesin penerbit tagihan bulanan (idempotent)
backend/src/ringkasan.js  hitung sisa dan saldo dari database + batas bayar di muka
backend/src/routes/       endpoint API
frontend/src/pages/       halaman React
```

## Pengaturan (.env)

| Nama                        | Arti                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `BATAS_BAYAR_DI_MUKA_BULAN` | Saldo lebih bayar maksimal berapa kali biaya bulanan (bawaan 12 = setahun). Kosong = tanpa batas. |
| `BULAN_MULAI_TAHUN_AJARAN`  | Bulan (1-12) tahun ajaran baru dimulai; SPP tahunan terbit pada bulan ini. Bawaan 7 (Juli).       |
| `BULAN_DIKECUALIKAN`        | Bulan 1-12 yang tidak ditagih. Kosong = setahun penuh (sesuai keputusan).                         |
| `COOKIE_SECURE`             | `true` jika diakses lewat HTTPS.                                                                  |

## Catatan perilaku

- Batas bayar di muka dihitung dari saldo setelah bayar (saldo yang sudah ada ikut dihitung), sehingga totalnya tidak pernah melebihi 12 bulan.
- Menambah jenis bulanan atau tahunan ke siswa yang sudah ada (lewat _Edit_) menerbitkan tagihannya sejak bulan mulai tagih siswa itu. Mencabut suatu jenis hanya bisa jika belum ada pembayaran untuk jenis itu; tagihannya ikut dihapus.
- Mengganti golongan bulanan atau tahunan butuh "berlaku mulai bulan" (antara bulan mulai tagih dan bulan berjalan). Tagihan sebelum bulan itu tidak berubah.
- Mengaktifkan kembali siswa yang sudah lulus akan menerbitkan tagihan bulan-bulan yang terlewat.
- Ekspor Excel (opsional di blueprint) belum dibuat; gunakan _Cetak / simpan PDF_.
- Login memakai cookie JWT (httpOnly, 8 jam), maksimal 5 percobaan gagal per 15 menit.
