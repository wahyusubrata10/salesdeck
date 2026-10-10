// Kolom standar yang dipakai dashboard. Setiap distributor memetakan header
// Excel-nya sendiri ke kolom-kolom ini.
export type FieldKey =
  | 'tanggal'
  | 'faktur'
  | 'kodeCustomer'
  | 'namaCustomer'
  | 'salesman'
  | 'kodeBarang'
  | 'namaBarang'
  | 'brand'
  | 'kategori'
  | 'omset'
  | 'qty'

export type Channel = 'GT' | 'MT' | 'X' // X = diabaikan

export interface DistributorConfig {
  id: string
  nama: string
  sheet?: string
  headerRow?: number // 0-based index baris header
  mapping: Partial<Record<FieldKey, string>> // field -> nama header
  // nilai mentah kolom kategori -> channel. Nilai yang tidak ada di sini memakai defaultChannel.
  channelMap: Record<string, Channel>
  defaultChannel: Channel
  // nilai mentah kolom brand -> nama grup brand. Kosong/tidak ada = pakai nilai mentah.
  brandMap: Record<string, string>
  fileName?: string
  updatedAt?: string
  rowCount?: number
}

// Satu baris transaksi yang sudah dinormalisasi.
export interface SaleRow {
  d: string // YYYY-MM-DD
  f: string // no faktur
  c: string // kode customer
  cn: string // nama customer
  s: string // salesman
  k: string // kode barang
  n: string // nama barang
  br: string // brand mentah
  kt: string // kategori mentah
  om: number // omset (Rp)
  q: number // qty
}

export interface TargetLine {
  omset: number
  ea: number
}

export interface MonthTarget {
  GT: TargetLine
  MT: TargetLine
  ecHk: number // target rata-rata EC per hari kerja
  asrt: number // target assortment (SKU) per EA GT
  // key: `${channel}|${grupBrand}`
  brand: Record<string, TargetLine>
}

// distributorId -> 'YYYY-MM' -> target
export type Targets = Record<string, Record<string, MonthTarget>>

export const emptyTarget = (): MonthTarget => ({
  GT: { omset: 0, ea: 0 },
  MT: { omset: 0, ea: 0 },
  ecHk: 0,
  asrt: 0,
  brand: {},
})
