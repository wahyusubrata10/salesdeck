# SalesDeck

Website pribadi untuk memantau penjualan 4 distributor dari file Excel masing-masing,
meskipun header kolom tiap distributor berbeda.

## Cara pakai

1. **Upload data penjualan** (tab Ringkasan / Data): pilih 1–4 file **data mentah dari email** (Excel/CSV) — dari HP juga bisa.
   Tidak perlu file monitoring lengkap. Distributor dikenali otomatis dari **judul kolom** (nama file & nama sheet bebas).
   Data pada rentang tanggal di file menggantikan data lama pada tanggal yang sama; tanggal lain tetap
   (jadi file harian, mingguan, maupun kumulatif sama-sama aman).
2. **Target**: pilih bulan & tahun, isi target omset & EA per channel, EC/HK, assortment, dan per brand.
   Target dari Excel sudah terisi otomatis (SJA Jul, Teweh & Buntok Sep, Tanjung Jul–Sep 2026).
3. **Ringkasan**: kartu per distributor (omset, tren vs bulan lalu, pencapaian vs time gone), grafik, matriks brand × distributor.
4. **Tab distributor**: Ikhtisar · Toko · Produk · Salesman · Area · Transaksi. **Semua bisa diklik** untuk melihat detail:
   toko (alamat, area, salesman, tren per bulan, brand, produk dibeli, riwayat faktur, terakhir order),
   produk (toko pembeli, toko yang biasa beli tapi bulan ini belum), salesman/area (EA, EC, toko belum order),
   brand, hari, dan isi faktur. Di dalam panel detail pun bisa klik lagi (tombol ‹ Kembali).

### Master barang tertanam

File mentah tidak punya kolom Brand / GT-MT, jadi website memakai master barang yang disalin dari Excel
(`src/data/items.json`, dibuat dari sheet *Kat Tabi*, *Master Item Regular*, *Mapping Item* dan hasil rumus di sheet database):

| Distributor | Kolom kunci di file mentah | Master |
|---|---|---|
| SJA Barabai | `Kode Barang` (kode Nutrifood) | Kat Tabi + Database SJA |
| Teweh | `kode_brg` | Master Item Regular Teweh + DATABASE |
| Buntok | `Kode Brg` (ACS-NFxx) | Mapping Item + Master Item Regular → harga NFI per satuan |
| Tanjung | `KODE ITEM` (N301050P → N301050) | Master Item Regular Tanjung + DATABASE |

Barang baru yang belum ada di master ditandai di dashboard dan bisa dilengkapi di **Data & Pengaturan → Master barang**.

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

## Hosting gratis + sinkron antar perangkat (Cloudflare)

Website di-host di **Cloudflare Workers**, data disimpan di **Cloudflare KV** (keduanya gratis) dan dilindungi password.
Setiap upload Excel, perubahan target, dan pengaturan otomatis tersinkron ke semua perangkat (laptop, HP, dll.).

Setup sekali (Cloudflare **Workers**; konfigurasi ada di `wrangler.jsonc`):

1. dash.cloudflare.com → *Workers & Pages* → *Create* → *Import a repository* → pilih repo `salesdeck`,
   project name `salesdeck`. Build command `npm run build`, deploy command `npx wrangler deploy` → *Deploy*.
   KV `SALESDECK` dibuat otomatis saat deploy pertama.
2. Project `salesdeck` → *Settings* → *Variables and secrets* → *Add* → type **Secret**,
   name **`APP_PASSWORD`**, value: password pilihanmu → *Deploy*.
3. Buka `https://salesdeck.<akun>.workers.dev`, klik **☁ Masuk untuk sinkron** di kanan atas, masukkan password.
   Ulangi sekali di setiap perangkat.

Setiap push ke GitHub otomatis ter-deploy. (Alternatif Cloudflare Pages juga didukung lewat folder `functions/`:
binding KV `SALESDECK` dan secret `APP_PASSWORD` diatur di dashboard Pages.)

Cara kerja sinkron: data disimpan dulu di perangkat (tetap bisa dipakai offline), lalu dikirim ke cloud
beberapa detik setelah berubah. Perangkat lain menarik data terbaru saat website dibuka, saat tab aktif lagi,
dan setiap menit. Bila dua perangkat mengubah hal yang sama, perubahan terakhir yang dipakai.
Batas gratis KV (1.000 penulisan & 100.000 pembacaan per hari) jauh di atas kebutuhan pemakaian normal.

Tanpa Cloudflare (mis. `npm run dev` atau hosting statis lain) aplikasi tetap jalan dalam mode **Lokal saja**.

## Privasi

Data penjualan hanya bisa dibaca dengan password (`APP_PASSWORD`). Password disimpan di browser perangkat yang
sudah masuk; gunakan **Keluar dari perangkat ini** (klik ikon ☁) di perangkat yang bukan milikmu.

## Pengembangan

```bash
npm install
npm run dev       # http://localhost:5173 (mode lokal saja)
npm run dev:cf    # Cloudflare Worker lokal + KV, password "dev" (http://localhost:8787)
npm run deploy    # deploy manual ke Cloudflare (butuh `wrangler login`)
npm test          # unit test
npm run build     # hasil statis di dist/ (bisa di-host di GitHub Pages, Netlify, dll.)
```

Uji integrasi dengan file Excel asli 4 distributor (file tidak ikut di-commit) — memastikan angka sama dengan sheet Dashboard:

```bash
SAMPLE_DIR=/folder/berisi/file-excel npm test
```

Stack: Vite + React + TypeScript, SheetJS (parsing di Web Worker), Recharts, idb-keyval.
