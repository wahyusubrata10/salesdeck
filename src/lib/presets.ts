import type { DistributorConfig } from './types'

const base = {
  channelMap: { POLOS: 'GT', 'NON POLOS': 'MT', '': 'X', '-': 'X' },
  defaultChannel: 'GT',
  trxMap: {},
  brandMap: {},
  salesmanMap: {},
  omsetMode: 'kolom',
  items: {},
} satisfies Partial<DistributorConfig>

// Pemetaan bawaan untuk 4 distributor, disusun dari contoh file masing-masing.
// Semua bisa diubah di tab Data & Pengaturan.
export const PRESETS: DistributorConfig[] = [
  {
    ...base,
    id: 'd1',
    nama: 'SJA Barabai',
    fileHint: 'BARABAI',
    sheet: 'Database',
    headerRow: 0,
    mapping: {
      tanggal: 'Tanggal', faktur: 'No. Faktur', kodeCustomer: 'Kode Customer', namaCustomer: 'Nama Customer',
      salesman: 'Nama Salesman', kodeBarang: 'Kode Barang', namaBarang: 'Nama Barang', brand: 'Brand',
      kategori: 'Kategori', omset: 'Jumlah (Rp)', qty: 'Total Qty (Pcs)',
    },
    // Di file SJA ada brand "HILO TRADITIONAL" yang sebenarnya HI LO.
    brandMap: { 'HILO TRADITIONAL': 'HI LO' },
  },
  {
    ...base,
    id: 'd2',
    nama: 'Teweh',
    fileHint: 'TEWEH',
    sheet: 'DATABASE',
    headerRow: 0,
    mapping: {
      tanggal: 'tanggal', faktur: 'kode_jual', kodeCustomer: 'kode_cus', namaCustomer: 'nama',
      salesman: 'nama_sales', kodeBarang: 'kode_brg', namaBarang: 'nama_brg', brand: 'BRAND',
      kategori: 'CHANNEL', omset: 'total',
    },
  },
  {
    ...base,
    id: 'd3',
    nama: 'Buntok',
    fileHint: 'BUNTOK',
    // Data mentah distributor; brand, channel & harga NFI diambil dari master barang.
    sheet: 'PENJUALAN',
    headerRow: 1,
    mapping: {
      tanggal: 'Tanggal', faktur: 'No.Nota', namaCustomer: 'Nama Pelanggan', kodeBarang: 'Kode Brg',
      namaBarang: 'Nama Brg', qty: 'Banyak', omset: 'Value',
    },
    omsetMode: 'master',
    itemSource: {
      sheet: 'DATA RAPI', headerRow: 0, key: 'Kode Brg (Distributor)', nama: 'Nama Item (Standar)',
      brand: 'Brand', channel: 'Kelompok Item', harga: 'Harga NFI',
    },
  },
  {
    ...base,
    id: 'd4',
    nama: 'Tanjung',
    fileHint: 'TANJUNG',
    sheet: 'DATABASE',
    headerRow: 0,
    mapping: {
      tanggal: 'TANGGAL', faktur: 'NOMOR FAKTUR', kodeCustomer: 'KODE', namaCustomer: 'NAMA OUTLET',
      salesman: 'SALES', kodeBarang: 'KODE ITEM', namaBarang: 'ITEM', brand: 'BRAND', kategori: 'CHANNEL',
      jenis: 'KET', omset: 'VALUE', qty: 'QTY',
    },
  },
]

// Melengkapi config lama (dari versi sebelumnya) dengan field baru.
export function upgradeConfig(c: Partial<DistributorConfig> & { id: string }): DistributorConfig {
  const preset = PRESETS.find((p) => p.id === c.id) ?? PRESETS[0]
  return {
    ...preset,
    ...c,
    trxMap: c.trxMap ?? {},
    salesmanMap: c.salesmanMap ?? {},
    items: c.items ?? {},
    omsetMode: c.omsetMode ?? 'kolom',
  } as DistributorConfig
}
