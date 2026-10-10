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
  | 'jenis'
  | 'omset'
  | 'qty'

export type Mapping = Partial<Record<FieldKey, string>>

export type Channel = 'GT' | 'MT' | 'X' // X = diabaikan
export type TrxKind = 'IN' | 'X' // IN = dihitung, X = diabaikan

// Data master per kode barang distributor (dipakai bila file penjualan tidak punya brand/channel/harga NFI).
export interface ItemInfo {
  nama?: string
  brand?: string
  channel?: string // nilai mentah, mis. POLOS / NON POLOS
  harga?: number // harga NFI per satuan jual distributor
}

// Sheet di file yang sama untuk memperbarui master barang setiap upload.
export interface ItemSource {
  sheet: string
  headerRow: number
  key: string
  nama?: string
  brand?: string
  channel?: string
  harga?: string
}

export interface DistributorConfig {
  id: string
  nama: string
  fileHint?: string // kata kunci di nama file, mis. "TEWEH"
  sheet?: string
  headerRow?: number // 0-based index baris header
  mapping: Mapping // field -> nama header
  channelMap: Record<string, Channel> // nilai kategori -> channel
  defaultChannel: Channel // dipakai bila tidak ada kolom kategori
  trxMap: Record<string, TrxKind> // nilai kolom jenis transaksi -> dihitung/diabaikan
  brandMap: Record<string, string> // nilai brand -> nama grup brand
  salesmanMap: Record<string, string> // penyamaan nama salesman
  // 'kolom' = omset dari kolom omset; 'master' = qty × harga NFI dari master barang
  omsetMode: 'kolom' | 'master'
  items: Record<string, ItemInfo>
  itemSource?: ItemSource
  fileName?: string
  updatedAt?: string
  rowCount?: number
}

// Satu baris transaksi yang sudah dinormalisasi (nilai mentah; aturan diterapkan saat menghitung).
export interface SaleRow {
  d: string // YYYY-MM-DD
  f: string // no faktur
  c: string // kode customer (atau nama bila tidak ada kode)
  cn: string // nama customer
  s: string // salesman
  k: string // kode barang
  n: string // nama barang
  br: string // brand mentah
  kt: string // kategori mentah
  tx: string // jenis transaksi mentah
  om: number // omset dari kolom (Rp)
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

export const isTargetFilled = (t?: MonthTarget) => !!t && t.GT.omset + t.MT.omset > 0
