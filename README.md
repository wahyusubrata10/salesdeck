# SalesDeck

Website pribadi untuk memantau penjualan 4 distributor dari file Excel masing-masing,
meskipun header kolom tiap distributor berbeda.

## Cara pakai

1. **Upload file progress** (tab Ringkasan): tarik 1–4 file Excel sekaligus. Distributor dikenali otomatis
   dari nama file + struktur sheet, lalu dashboard langsung diperbarui. Upload ulang menggantikan data distributor itu.
2. **Target**: pilih bulan & tahun (termasuk bulan depan), isi target omset & EA per channel, EC/HK, assortment,
   dan target per brand (bisa dibagi otomatis sesuai kontribusi 3 bulan terakhir, atau disalin dari bulan lalu).
   Tabel **Status target** menandai bulan/distributor yang belum diisi; Ringkasan juga menampilkan pengingat.
3. **Ringkasan**: perbandingan 4 distributor + matriks brand × distributor.
   **Tab distributor**: detail seperti sheet Dashboard, dengan filter salesman / brand / GT-MT
   (klik baris tabel salesman atau brand untuk memfilter).

### Preset bawaan per distributor

| Distributor | Sheet | Omset | Catatan |
|---|---|---|---|
| SJA Barabai | `Database` | `Jumlah (Rp)` | GT/MT dari `Kategori`; brand "HILO TRADITIONAL" digabung ke HI LO |
| Teweh | `DATABASE` | `total` | GT/MT dari `CHANNEL` |
| Buntok | `PENJUALAN` (data mentah) | qty × harga NFI | brand, GT/MT & harga NFI dari master barang yang dibaca dari sheet `DATA RAPI` setiap upload; EA per nama pelanggan |
| Tanjung | `DATABASE` | `VALUE` | hanya `FAKTUR PENJUALAN`; retur & pembelian diabaikan (bisa diubah) |

Bila format file berubah, buka **Data & Pengaturan → Upload & atur pemetaan** untuk distributor tersebut.
Di sana juga ada **aturan data**: jenis transaksi, GT/MT, grup brand, penyamaan nama salesman, dan **master barang**
(kode → brand, channel, harga NFI; barang yang belum punya harga ditandai).

## Definisi metrik

| Metrik | Rumus |
|---|---|
| Omset | kolom omset atau qty × harga NFI (master barang); baris dengan jenis transaksi/channel "Abaikan" tidak dihitung |
| GT / MT | dari kolom kategori, mis. `POLOS` = GT, `NON POLOS` = MT |
| %Ach | omset ÷ target |
| Time Gone | hari kerja yang sudah lewat ÷ total hari kerja bulan itu (Senin–Sabtu) |
| GAP vs TG | %Ach − Time Gone (≥ 0 on track, sampai −10% sedikit tertinggal, di bawah itu tertinggal) |
| Rata-rata omset / HK | omset ÷ jumlah hari yang ada transaksinya |
| Estimasi closing | omset + rata-rata omset/HK × sisa hari kerja |
| EA | jumlah customer unik |
| EC / HK | rata-rata jumlah faktur unik per hari transaksi |
| Assortment / EA | rata-rata jumlah SKU unik per customer (GT) |

## Hosting gratis

Website ini statis (tanpa server), jadi bisa di-host gratis. Pilih salah satu:

**GitHub Pages** (workflow sudah tersedia di `.github/workflows/deploy.yml`)
1. Buka repo → **Settings → Pages** → *Build and deployment* → Source: **GitHub Actions**.
2. Buka tab **Actions** → workflow **Deploy** → **Run workflow** (atau push commit baru).
3. Website tersedia di `https://wahyusubrata10.github.io/salesdeck/`. Setiap push berikutnya otomatis ter-deploy.

**Cloudflare Pages**
1. Masuk ke dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**, pilih repo `salesdeck`.
2. Production branch: branch yang dipakai (mis. `main`), Framework preset: **Vite** (atau isi manual:
   build command `npm run build`, output directory `dist`).
3. Website tersedia di `https://salesdeck.pages.dev` (atau nama lain yang dipilih). Setiap push otomatis ter-deploy.

Website yang di-host hanya berisi aplikasinya; data penjualan tetap di browser masing-masing perangkat.
Di HP/laptop lain, upload file Excel lagi dan gunakan **Export/Import pengaturan & target** untuk memindahkan target.

## Privasi

Semua data hanya disimpan di **IndexedDB browser** yang dipakai, tidak dikirim ke server mana pun.
Gunakan **Export pengaturan & target** untuk cadangan atau pindah perangkat (file Excel perlu di-upload ulang).

## Pengembangan

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # unit test
npm run build     # hasil statis di dist/ (bisa di-host di GitHub Pages, Netlify, dll.)
```

Uji integrasi dengan file Excel asli 4 distributor (file tidak ikut di-commit) — memastikan angka sama dengan sheet Dashboard:

```bash
SAMPLE_DIR=/folder/berisi/file-excel npm test
```

Stack: Vite + React + TypeScript, SheetJS (parsing di Web Worker), Recharts, idb-keyval.
