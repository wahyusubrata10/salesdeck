import * as XLSX from 'xlsx'
import { dedupeHeaders, headerScore } from './fields'
import type { FieldKey, ItemInfo, ItemSource, Mapping, SaleRow } from './types'
import { parseDate, parseNumber, str } from './values'

export interface SheetInfo {
  name: string
  headerRow: number
  headers: string[]
  score: number
  rows: number // perkiraan jumlah baris sheet
  top: unknown[][] // baris-baris teratas (untuk memilih baris header secara manual)
}

export interface ParseResult {
  rows: SaleRow[]
  skipped: number
  minDate: string | null
  maxDate: string | null
  items?: Record<string, ItemInfo>
  itemError?: string
}

const SCAN_ROWS = 30

// Kode unik customer bila file tidak punya kolom kode: nama tanpa spasi/tanda baca, huruf kecil.
// "B7 DS LINA" -> "b7dslina"
export const customerKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '')

// Hanya nilai sel yang dibutuhkan; mematikan rumus/format membuat parsing ~4x lebih cepat.
const LEAN = { cellFormula: false, cellHTML: false, cellText: false, cellNF: false, cellStyles: false } as const

export function inspect(buf: ArrayBuffer): SheetInfo[] {
  const wb = XLSX.read(buf, { ...LEAN, type: 'array', sheetRows: SCAN_ROWS + 6 })
  return wb.SheetNames.map((name) => {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: null })
    let best = 0
    let bestScore = -1
    aoa.slice(0, SCAN_ROWS).forEach((row, i) => {
      const sc = headerScore(row.map(str))
      if (sc > bestScore) {
        bestScore = sc
        best = i
      }
    })
    const ws = wb.Sheets[name]
    const ref = (ws['!fullref'] as string | undefined) ?? ws['!ref']
    return {
      name,
      headerRow: best,
      headers: dedupeHeaders(aoa[best] ?? []),
      score: Math.max(bestScore, 0),
      rows: ref ? XLSX.utils.decode_range(ref).e.r + 1 : 0,
      top: aoa,
    }
  })
}

export interface ParseOptions {
  sheet: string
  headerRow: number
  mapping: Mapping
  itemSource?: ItemSource
}

const readSheet = (wb: XLSX.WorkBook, name: string) => {
  const ws = wb.Sheets[name]
  if (!ws) throw new Error(`Sheet "${name}" tidak ditemukan`)
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null })
}

// Membaca master barang (kode -> brand/channel/harga) dari sheet lain di file yang sama.
function readItems(wb: XLSX.WorkBook, src: ItemSource): Record<string, ItemInfo> {
  const aoa = readSheet(wb, src.sheet)
  const headers = dedupeHeaders(aoa[src.headerRow] ?? [])
  const ix = (h?: string) => (h ? headers.indexOf(h) : -1)
  const [k, n, b, c, h] = [ix(src.key), ix(src.nama), ix(src.brand), ix(src.channel), ix(src.harga)]
  if (k < 0) throw new Error(`Kolom kunci "${src.key}" tidak ada di sheet "${src.sheet}"`)
  const out: Record<string, ItemInfo> = {}
  for (let r = src.headerRow + 1; r < aoa.length; r++) {
    const row = aoa[r]
    const key = str(row?.[k])
    if (!key) continue
    const it: ItemInfo = out[key] ?? {}
    const take = (i: number) => (i >= 0 ? str(row[i]) : '')
    const valid = (v: string) => v && v !== '-' && !/belum dimapping|#n\/a/i.test(v)
    if (valid(take(n))) it.nama = take(n)
    if (valid(take(b))) it.brand = take(b)
    if (valid(take(c))) it.channel = take(c)
    if (h >= 0) {
      const price = parseNumber(row[h])
      if (price > 0) it.harga = price
    }
    out[key] = it
  }
  return out
}

export function parse(buf: ArrayBuffer, opt: ParseOptions): ParseResult {
  const { sheet, headerRow, mapping, itemSource } = opt
  const sheets = itemSource && itemSource.sheet !== sheet ? [sheet, itemSource.sheet] : [sheet]
  const wb = XLSX.read(buf, { ...LEAN, type: 'array', sheets, dense: true })
  const aoa = readSheet(wb, sheet)
  const headers = dedupeHeaders(aoa[headerRow] ?? [])
  const col = (k: FieldKey) => (mapping[k] ? headers.indexOf(mapping[k]!) : -1)
  const ix = {
    d: col('tanggal'), f: col('faktur'), c: col('kodeCustomer'), cn: col('namaCustomer'),
    s: col('salesman'), k: col('kodeBarang'), n: col('namaBarang'), br: col('brand'),
    kt: col('kategori'), tx: col('jenis'), om: col('omset'), q: col('qty'),
  }
  for (const [k, h] of Object.entries(mapping)) {
    if (h && !headers.includes(h)) throw new Error(`Kolom "${h}" (${k}) tidak ditemukan di sheet "${sheet}"`)
  }
  if (ix.d < 0 || (ix.c < 0 && ix.cn < 0)) throw new Error('Kolom Tanggal dan Kode/Nama Customer wajib dipetakan')
  const get = (row: unknown[], i: number) => (i >= 0 ? row[i] : null)

  let items: Record<string, ItemInfo> | undefined
  let itemError: string | undefined
  if (itemSource) {
    try {
      items = readItems(wb, itemSource)
    } catch (e) {
      itemError = e instanceof Error ? e.message : String(e)
    }
  }

  const rows: SaleRow[] = []
  let skipped = 0
  let minDate: string | null = null
  let maxDate: string | null = null
  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = aoa[r]
    if (!row || row.every((v) => v == null || v === '')) continue
    const d = parseDate(get(row, ix.d))
    const cn = str(get(row, ix.cn))
    const c = str(get(row, ix.c)) || customerKey(cn)
    if (!d || !c) {
      skipped++
      continue
    }
    const n = str(get(row, ix.n))
    rows.push({
      d,
      f: str(get(row, ix.f)),
      c,
      cn: cn || c,
      s: str(get(row, ix.s)) || '(tanpa salesman)',
      k: str(get(row, ix.k)) || n,
      n,
      br: str(get(row, ix.br)),
      kt: str(get(row, ix.kt)),
      tx: str(get(row, ix.tx)),
      om: parseNumber(get(row, ix.om)),
      q: parseNumber(get(row, ix.q)),
    })
    if (!minDate || d < minDate) minDate = d
    if (!maxDate || d > maxDate) maxDate = d
  }
  return { rows, skipped, minDate, maxDate, items, itemError }
}
