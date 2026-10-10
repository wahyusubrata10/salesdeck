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

// Naikkan setiap kali pemetaan bawaan berubah; config lama otomatis diperbarui (lihat upgradeConfig).
export const PRESET_VERSION = 3

// Pemetaan bawaan untuk 4 distributor, disusun dari kolom ASLI file data mentah masing-masing
// (bukan kolom tambahan hasil rumus). Brand & GT/MT diambil dari master barang tertanam (masters.ts).
export const PRESETS: DistributorConfig[] = [
  {
    ...base,
    id: 'd1',
    nama: 'SJA Barabai',
    fileHint: 'BARABAI',
    presetVersion: PRESET_VERSION,
    sheet: 'Database',
    headerRow: 0,
    mapping: {
      tanggal: 'Tanggal', faktur: 'No. Faktur', kodeCustomer: 'Kode Customer', namaCustomer: 'Nama Customer',
      salesman: 'Nama Salesman', kodeBarang: 'Kode Barang', namaBarang: 'Nama Barang', omset: 'Jumlah (Rp)',
      qty: 'Total Qty (Pcs)', alamat: 'Alamat', area: 'Nama Pasar',
    },
    // Di master SJA ada brand "HILO TRADITIONAL" yang sebenarnya HI LO.
    brandMap: { 'HILO TRADITIONAL': 'HI LO' },
  },
  {
    ...base,
    id: 'd2',
    nama: 'Teweh',
    fileHint: 'TEWEH',
    presetVersion: PRESET_VERSION,
    sheet: 'DATABASE',
    headerRow: 0,
    mapping: {
      tanggal: 'tanggal', faktur: 'kode_jual', kodeCustomer: 'kode_cus', namaCustomer: 'nama',
      salesman: 'nama_sales', kodeBarang: 'kode_brg', namaBarang: 'nama_brg', omset: 'total',
      alamat: 'alamat', area: 'kec.',
    },
  },
  {
    ...base,
    id: 'd3',
    nama: 'Buntok',
    fileHint: 'BUNTOK',
    presetVersion: PRESET_VERSION,
    // Data mentah distributor; brand, GT/MT & harga NFI dari master barang (Mapping Item + Master Item Regular).
    sheet: 'PENJUALAN',
    headerRow: 1,
    mapping: {
      tanggal: 'Tanggal', faktur: 'No.Nota', namaCustomer: 'Nama Pelanggan', kodeBarang: 'Kode Brg',
      namaBarang: 'Nama Brg', qty: 'Banyak', omset: 'Value',
    },
    omsetMode: 'master',
  },
  {
    ...base,
    id: 'd4',
    nama: 'Tanjung',
    fileHint: 'TANJUNG',
    presetVersion: PRESET_VERSION,
    sheet: 'DATABASE',
    headerRow: 0,
    itemKeyPattern: 'N\\d{6}', // KODE ITEM "N301050P" -> kode master "N301050"
    mapping: {
      tanggal: 'TANGGAL', faktur: 'NOMOR FAKTUR', kodeCustomer: 'KODE', namaCustomer: 'NAMA OUTLET',
      salesman: 'SALES', kodeBarang: 'KODE ITEM', namaBarang: 'ITEM', jenis: 'KET', omset: 'VALUE', qty: 'QTY',
      area: 'DEPO',
    },
    // Sistem distributor mengganti format nama salesman mulai April 2026.
    salesmanMap: {
      'YUDA - NUTRIFOOD': 'Yuda Arbaniansyah',
      DADI: 'Bugdadi',
      'AIDA - MDNutrifood': 'Aida - MD Nutrifood',
      HAMIDANSYAH: 'Hamid',
    },
  },
]

// Melengkapi config lama dengan field baru. Bila preset pemetaan lebih baru, pemetaan file diganti preset
// (nama, master barang, aturan brand/salesman/jenis transaksi buatan pengguna tetap dipertahankan).
export function upgradeConfig(c: Partial<DistributorConfig> & { id: string }): DistributorConfig {
  const preset = PRESETS.find((p) => p.id === c.id) ?? PRESETS[0]
  const merged = {
    ...preset,
    ...c,
    trxMap: c.trxMap ?? {},
    salesmanMap: c.salesmanMap ?? {},
    items: c.items ?? {},
    omsetMode: c.omsetMode ?? 'kolom',
  } as DistributorConfig
  if ((c.presetVersion ?? 0) < PRESET_VERSION && PRESETS.some((p) => p.id === c.id)) {
    const { sheet, headerRow, mapping, omsetMode, itemKeyPattern, itemSource, fileHint, presetVersion } = preset
    Object.assign(merged, { sheet, headerRow, mapping, omsetMode, itemKeyPattern, itemSource, fileHint, presetVersion })
    merged.brandMap = { ...preset.brandMap, ...c.brandMap }
    merged.salesmanMap = { ...preset.salesmanMap, ...c.salesmanMap }
  }
  return merged
}
