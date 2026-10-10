# SalesDeck

Website pribadi untuk memantau penjualan 4 distributor dari file Excel masing-masing,
meskipun header kolom tiap distributor berbeda.

## Cara pakai

1. **Data & Pengaturan**: beri nama tiap distributor, lalu **Upload Excel**.
   - Sheet data dan baris header dideteksi otomatis (mis. sheet `Database`).
   - Cek pemetaan kolom: header Excel → kolom standar (Tanggal, Omset, Kode Customer, No. Faktur, Salesman, Brand, Kategori, dll.).
     Pemetaan disimpan per distributor, jadi upload berikutnya langsung memakai pemetaan yang sama.
   - **Atur pemetaan GT/MT & grup brand**: tentukan nilai kolom kategori mana yang GT/MT/diabaikan,
     dan samakan nama brand antar distributor.
2. **Target**: isi target omset & EA per channel, EC/HK, assortment, dan target per brand
   (bisa dibagi otomatis sesuai kontribusi 3 bulan terakhir, atau disalin dari bulan lalu).
3. **Ringkasan**: perbandingan 4 distributor. **Tab distributor**: detail seperti sheet Dashboard.

Upload ulang menggantikan seluruh data distributor tersebut (file biasanya berisi data kumulatif).

## Definisi metrik

| Metrik | Rumus |
|---|---|
| Omset | jumlah kolom omset (mis. `Jumlah (Rp)`), baris dengan channel "Abaikan" tidak dihitung |
| GT / MT | dari kolom kategori, mis. `POLOS` = GT, `NON POLOS` = MT |
| %Ach | omset ÷ target |
| Time Gone | hari kerja yang sudah lewat ÷ total hari kerja bulan itu (Senin–Sabtu) |
| GAP vs TG | %Ach − Time Gone (≥ 0 on track, sampai −10% sedikit tertinggal, di bawah itu tertinggal) |
| Rata-rata omset / HK | omset ÷ jumlah hari yang ada transaksinya |
| Estimasi closing | omset + rata-rata omset/HK × sisa hari kerja |
| EA | jumlah customer unik |
| EC / HK | rata-rata jumlah faktur unik per hari transaksi |
| Assortment / EA | rata-rata jumlah SKU unik per customer (GT) |

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

Uji integrasi dengan file Excel asli (file tidak ikut di-commit):

```bash
SAMPLE_XLSX=/path/ke/Q1_2026_SJA_BARABAI.xlsx npm test
```

Stack: Vite + React + TypeScript, SheetJS (parsing di Web Worker), Recharts, idb-keyval.
