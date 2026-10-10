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

## Hosting gratis + sinkron antar perangkat (Cloudflare)

Website di-host di **Cloudflare Pages**, data disimpan di **Cloudflare KV** (keduanya gratis) dan dilindungi password.
Setiap upload Excel, perubahan target, dan pengaturan otomatis tersinkron ke semua perangkat (laptop, HP, dll.).

Setup sekali:

1. **Buat project Pages** — dash.cloudflare.com → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* →
   pilih repo `salesdeck`. Production branch: branch yang dipakai. Framework preset **Vite**
   (build command `npm run build`, output directory `dist`) → *Save and Deploy*.
2. **Buat KV** — *Storage & Databases* → *KV* → *Create* → nama `salesdeck`.
3. **Hubungkan KV** — project Pages → *Settings* → *Bindings* → *Add* → *KV namespace*:
   variable name **`SALESDECK`**, namespace `salesdeck`.
4. **Password** — project Pages → *Settings* → *Variables and Secrets* → *Add* → type *Secret*,
   name **`APP_PASSWORD`**, value: password pilihanmu (buat yang panjang).
5. **Deploy ulang** — tab *Deployments* → deployment terbaru → *Retry deployment* (agar binding & password aktif).
6. Buka `https://<nama-project>.pages.dev`, klik **☁ Masuk untuk sinkron** di kanan atas, masukkan password.
   Ulangi langkah ini sekali di setiap perangkat.

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
npm run dev:cf    # Cloudflare Pages lokal + KV, password "dev" (http://localhost:8788)
npm test          # unit test
npm run build     # hasil statis di dist/ (bisa di-host di GitHub Pages, Netlify, dll.)
```

Uji integrasi dengan file Excel asli 4 distributor (file tidak ikut di-commit) — memastikan angka sama dengan sheet Dashboard:

```bash
SAMPLE_DIR=/folder/berisi/file-excel npm test
```

Stack: Vite + React + TypeScript, SheetJS (parsing di Web Worker), Recharts, idb-keyval.
