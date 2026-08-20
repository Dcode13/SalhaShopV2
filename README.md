# Salha Shop — Sistem Manajemen

Sistem manajemen dua unit usaha **Lapak Grosir** & **Kios Terminal**: POS kasir, stok + kartu stok (ledger), pembelian dengan HPP rata-rata bergerak, biaya operasional, shift & rekonsiliasi kas, serta dashboard dan rekap laba/rugi untuk owner.

**Stack:** Next.js 15 (App Router, Server Actions) · Prisma ORM · Supabase PostgreSQL · Tailwind CSS v4 · Recharts

## Tema

| Area | Warna | Alasan |
|---|---|---|
| **Owner** (`/owner/*`) | 🟣 Ungu/violet | Mengikuti warna logo `salhashoplogo.png` |
| **Kasir** (`/kasir/*`) | 🟢 Teal/hijau | Pembeda visual — kasir langsung tahu ia ada di aplikasi kasir |

Logo tampil di sidebar/navbar kedua area, halaman login, dan struk.

---

## Cara Menjalankan

### 1. Install dependensi

```bash
npm install
```

### 2. Siapkan database (Supabase)

1. Buat project di [supabase.com](https://supabase.com) (region terdekat: Singapore).
2. Buka **Project Settings → Database → Connection string**, salin ke `.env`:
   - `DATABASE_URL` — mode **Transaction pooler** (port 6543), tambahkan `?pgbouncer=true`
   - `DIRECT_URL` — mode **Direct connection** (port 5432)
3. `AUTH_SECRET` sudah terisi otomatis; ganti bila perlu.

### 3. Migrasi + seed

```bash
npx prisma migrate dev --name init   # buat semua tabel
npm run db:seed                      # 2 outlet, 3 user, kategori dasar, settings
npm run db:seed:demo                 # (opsional) 8 produk contoh + stok awal utk uji coba
```

### 4. Jalankan

```bash
npm run dev
```

Buka http://localhost:3000

**Akun awal (⚠️ segera ganti password lewat menu Pengguna):**

| Peran | Email | Password |
|---|---|---|
| Owner | `owner@salhashop.id` | `owner123` |
| Kasir Grosir | `kasir.grosir@salhashop.id` | `kasir123` |
| Kasir Kios | `kasir.kios@salhashop.id` | `kasir123` |

### 5. Deploy ke Vercel

1. Push repo ke GitHub (`.env` tidak ikut — sudah di `.gitignore`):
   ```bash
   git add -A
   git commit -m "Salha Shop MVP"
   git remote add origin https://github.com/USERNAME/SalhaShopManajemen.git
   git push -u origin main
   ```
2. Di [vercel.com](https://vercel.com) → **Add New Project** → import repo. Framework terdeteksi otomatis (Next.js); build script sudah menyertakan `prisma generate`.
3. Isi **Environment Variables** (samakan dengan `.env` lokal):
   - `DATABASE_URL` (transaction pooler 6543 + `?pgbouncer=true`)
   - `DIRECT_URL` (session pooler 5432)
   - `AUTH_SECRET`
   - `CRON_SECRET`
   - `SUPABASE_STORAGE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (foto produk — service_role dari Settings → API)
4. Deploy. Cron `daily_summaries` otomatis terjadwal dari `vercel.json` (`5 16 * * *` UTC = 00:05 WITA); Vercel mengirim header `Authorization: Bearer $CRON_SECRET` secara otomatis karena env var itu ada.
5. RLS (`supabase/rls.sql`) sudah diterapkan di database; tidak perlu diulang kecuali membuat project Supabase baru.

### 6. Sebelum go-live sungguhan

- Ganti semua password default (menu **Pengguna**).
- Setelah selesai masa uji coba, bersihkan data transaksi percobaan **tanpa menyentuh master data**:
  ```bash
  npm run db:reset-transaksi          # pratinjau (dry-run)
  npm run db:reset-transaksi -- --yes # eksekusi
  ```
- Stok opname fisik, lalu samakan angka lewat penyesuaian stok.

---

## Aturan Bisnis Penting (PRD §5)

- **HPP = weighted moving average** — dihitung ulang setiap "Terima Barang" di modul Pembelian.
- **`costAtSale` di-snapshot** saat transaksi POS → laba historis tidak berubah walau harga modal naik.
- **`stock_movements` = single source of truth** — semua mutasi stok (jual, beli, koreksi, void, stok awal `INITIAL`) tercatat sebagai ledger append-only; `inventories.qty` hanyalah cache.
- **Transaksi POS atomik** (`prisma.$transaction`) + guard `qty >= n` saat decrement stok → anti race-condition/stok minus.
- **Soft delete** — transaksi di-void (bukan dihapus), produk & user dinonaktifkan.
- **Pembelian stok ≠ biaya operasional** — nilai kulakan masuk laba lewat HPP saat terjual, bukan lewat expenses (mencegah double-count).
- **Kasir tidak pernah menerima data HPP/laba** — difilter di query server, bukan di UI.
- **Timezone WITA (Asia/Makassar)** — batas hari rekap dihitung di `src/lib/dates.ts`, bukan timezone server.
- **Stok awal > 0 wajib ber-HPP** — ditolak server; halaman **Kelengkapan Data** memblokir go-live selama masih ada pelanggarnya.

## Struktur

```
prisma/schema.prisma        # 25+ tabel sesuai PRD (Fase 2 sudah disiapkan)
src/lib/                    # auth (JWT cookie), format Rupiah, tanggal WITA, settings
src/server/actions/         # semua mutasi (server actions): sales, purchases, products, …
src/server/reports.ts       # agregasi omzet/HPP/laba (SQL group-by per hari WITA)
src/app/owner/*             # dashboard, produk, stok, pembelian, transaksi, biaya,
                            # rekap 4 periode, kas, kelengkapan, pengguna, pengaturan
src/app/kasir/*             # dashboard, POS, riwayat+struk, stok (tanpa HPP),
                            # pengeluaran, shift
src/app/api/cron/…          # pengisi cache daily_summaries
supabase/rls.sql            # Row Level Security (jaring pengaman terakhir)
```

## Otorisasi berlapis

1. **Middleware** — cek JWT session, `/owner/*` khusus OWNER, `/kasir/*` khusus KASIR.
2. **Server actions/pages** — `requireOwner()` / `requireKasir()`; `outletId` selalu diambil dari session, tidak pernah dari client.
3. **RLS Supabase** — `supabase/rls.sql`.

Autentikasi memakai email+password (bcrypt) di tabel `users` dengan session JWT (cookie httpOnly; kasir 12 jam, owner 7 hari). Kolom `supabaseId` sudah disiapkan bila kelak ingin migrasi ke Supabase Auth.

## Status Fitur

**MVP (selesai):** auth + role, master data (kategori/supplier/produk + satuan bertingkat + harga tier per outlet), form input produk cepat + stok awal `INITIAL` + halaman Kelengkapan Data, stok + kartu stok + penyesuaian (auto-expense "Kerugian Stok"), pembelian DRAFT→RECEIVED + HPP rata-rata, POS + transaksi atomik + struk, void oleh owner + audit log, hapus produk permanen (hanya produk tanpa riwayat; produk ber-riwayat dinonaktifkan), foto produk (kompres & konversi WebP ≤2 MB otomatis di browser → Supabase Storage bucket `produk`, tampil di daftar produk & kartu POS — setup bucket: `npx tsx scripts/setup-bucket.ts`), biaya operasional (termasuk biaya bersama), shift + rekonsiliasi kas, dashboard owner (KPI, grafik, perbandingan outlet, stok menipis, produk mati) & kasir, rekap harian/mingguan/bulanan/tahunan, tombol "Barang tidak ditemukan" → antrean permintaan produk.

**Fase 2 (skema DB sudah siap, UI belum):** stok opname digital, transfer antar outlet, piutang pelanggan, retur, export Excel/PDF, scan barcode kamera.
