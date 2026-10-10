import type { Channel, FieldKey, Mapping, TrxKind } from './types'

export interface FieldDef {
  key: FieldKey
  label: string
  required: boolean
  hint: string
  synonyms: string[] // urutan = prioritas
}

export const FIELDS: FieldDef[] = [
  {
    key: 'tanggal',
    label: 'Tanggal',
    required: true,
    hint: 'Tanggal transaksi / faktur',
    synonyms: ['tanggal', 'tgl', 'tanggal faktur', 'tgl faktur', 'tanggal transaksi', 'tgl transaksi', 'tanggal invoice', 'invoice date', 'date', 'tgl jual'],
  },
  {
    key: 'omset',
    label: 'Omset (Rp)',
    required: true,
    hint: 'Nilai penjualan yang dihitung sebagai omset',
    synonyms: ['jumlah rp', 'value dpp', 'omset', 'omzet', 'dpp rp', 'dpp', 'netto rp', 'netto', 'nilai jual', 'nilai', 'total rp', 'total', 'value', 'amount', 'sales value', 'jumlah'],
  },
  {
    key: 'kodeCustomer',
    label: 'Kode Customer',
    required: false,
    hint: 'Untuk EA (customer unik). Bila kosong, dipakai Nama Customer',
    synonyms: ['kode customer', 'kode cus', 'kd cus', 'kode', 'kode cust', 'kd customer', 'kode pelanggan', 'kd pelanggan', 'kode outlet', 'kd outlet', 'kode toko', 'kd toko', 'customer code', 'cust code', 'kd cust', 'id customer', 'customer id'],
  },
  {
    key: 'faktur',
    label: 'No. Faktur',
    required: false,
    hint: 'Dipakai untuk menghitung EC (faktur unik per hari)',
    synonyms: ['no faktur', 'nomor faktur', 'faktur', 'no nota', 'nomor nota', 'kode jual', 'no invoice', 'nomor invoice', 'invoice no', 'invoice', 'no nota', 'nota', 'no transaksi', 'kode faktur'],
  },
  {
    key: 'namaCustomer',
    label: 'Nama Customer',
    required: false,
    hint: 'Untuk daftar top toko',
    synonyms: ['nama customer', 'nama pelanggan', 'nama outlet', 'nama toko', 'customer name', 'customer', 'pelanggan', 'outlet', 'toko', 'nama'],
  },
  {
    key: 'salesman',
    label: 'Salesman',
    required: false,
    hint: 'Untuk tabel per salesman',
    synonyms: ['nama salesman', 'salesman', 'nama sales', 'sales', 'sales name', 'nama sales man', 'salesman name'],
  },
  {
    key: 'kodeBarang',
    label: 'Kode Barang',
    required: false,
    hint: 'Untuk assortment (SKU unik per customer)',
    synonyms: ['kode barang', 'kode brg', 'kd brg', 'kd barang', 'kode produk', 'kd produk', 'kode item', 'item code', 'product code', 'sku', 'plu'],
  },
  {
    key: 'namaBarang',
    label: 'Nama Barang',
    required: false,
    hint: 'Cadangan assortment jika kode barang tidak ada',
    synonyms: ['nama barang', 'nama brg', 'nama produk', 'nama item', 'produk', 'item', 'description', 'deskripsi', 'barang'],
  },
  {
    key: 'brand',
    label: 'Brand',
    required: false,
    hint: 'Untuk tabel per brand',
    synonyms: ['brand', 'merk', 'merek', 'brand name'],
  },
  {
    key: 'kategori',
    label: 'Kategori / Channel',
    required: false,
    hint: 'Kolom penentu GT vs MT (mis. POLOS / NON POLOS)',
    synonyms: ['channel', 'kelompok item', 'tipe channel', 'kategori channel', 'type channel', 'kategori', 'category'],
  },
  {
    key: 'jenis',
    label: 'Jenis Transaksi',
    required: false,
    hint: 'Untuk memisahkan penjualan dari retur/pembelian',
    synonyms: ['ket', 'keterangan', 'jenis transaksi', 'jenis', 'tipe transaksi', 'type transaksi', 'jenis faktur'],
  },
  {
    key: 'qty',
    label: 'Qty',
    required: false,
    hint: 'Jumlah barang (opsional)',
    synonyms: ['total qty pcs', 'qty jual pcs', 'qty pcs', 'qty', 'qty jual', 'quantity', 'kuantitas', 'banyak', 'pcs'],
  },
]

export const normHeader = (h: string) =>
  h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Tebak pemetaan header -> field berdasarkan sinonim.
export function guessMapping(headers: string[]): Mapping {
  const norm = headers.map(normHeader)
  const used = new Set<number>()
  const out: Mapping = {}
  for (const f of FIELDS) {
    for (const syn of f.synonyms) {
      const idx = norm.findIndex((h, i) => !used.has(i) && h === syn)
      if (idx >= 0) {
        out[f.key] = headers[idx]
        used.add(idx)
        break
      }
    }
  }
  return out
}

// Seberapa mirip sebuah baris dengan baris header: jumlah *jenis* kolom standar yang dikenali.
export function headerScore(cells: string[]): number {
  return Object.keys(guessMapping(cells)).length
}

// Header duplikat diberi akhiran " (2)", " (3)" agar tetap unik.
export function dedupeHeaders(row: unknown[]): string[] {
  const seen = new Map<string, number>()
  return row.map((v, i) => {
    let h = v == null || String(v).trim() === '' ? `Kolom ${i + 1}` : String(v).trim()
    const n = (seen.get(h) ?? 0) + 1
    seen.set(h, n)
    if (n > 1) h = `${h} (${n})`
    return h
  })
}

export function guessChannel(raw: string): Channel {
  const v = raw.trim().toLowerCase()
  if (!v || v === '-') return 'X'
  if (/non ?polos|modern|\bmt\b|minimarket|supermarket|hypermarket/.test(v)) return 'MT'
  return 'GT'
}

export function guessTrx(raw: string): TrxKind {
  return /retur|beli/i.test(raw) ? 'X' : 'IN'
}

// Field minimum agar data bisa diproses.
export function missingFields(m: Mapping, omsetMode: 'kolom' | 'master'): string[] {
  const out: string[] = []
  if (!m.tanggal) out.push('Tanggal')
  if (!m.kodeCustomer && !m.namaCustomer) out.push('Kode atau Nama Customer')
  if (omsetMode === 'kolom' && !m.omset) out.push('Omset')
  if (omsetMode === 'master' && (!m.qty || !m.kodeBarang)) out.push('Qty dan Kode Barang (omset dari master barang)')
  return out
}
