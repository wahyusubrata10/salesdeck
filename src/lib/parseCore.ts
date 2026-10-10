import * as XLSX from 'xlsx'
import { dedupeHeaders, headerScore } from './fields'
import type { FieldKey, SaleRow } from './types'
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
}

const SCAN_ROWS = 30

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

export function parse(buf: ArrayBuffer, sheet: string, headerRow: number, mapping: Partial<Record<FieldKey, string>>): ParseResult {
  const wb = XLSX.read(buf, { ...LEAN, type: 'array', sheets: [sheet], dense: true })
  const ws = wb.Sheets[sheet]
  if (!ws) throw new Error(`Sheet "${sheet}" tidak ditemukan`)
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null })
  const headers = dedupeHeaders(aoa[headerRow] ?? [])
  const col = (k: FieldKey) => (mapping[k] ? headers.indexOf(mapping[k]!) : -1)
  const ix = {
    d: col('tanggal'), f: col('faktur'), c: col('kodeCustomer'), cn: col('namaCustomer'),
    s: col('salesman'), k: col('kodeBarang'), n: col('namaBarang'), br: col('brand'),
    kt: col('kategori'), om: col('omset'), q: col('qty'),
  }
  if (ix.d < 0 || ix.om < 0 || ix.c < 0) throw new Error('Kolom Tanggal, Omset, dan Kode Customer wajib dipetakan')
  const get = (row: unknown[], i: number) => (i >= 0 ? row[i] : null)

  const rows: SaleRow[] = []
  let skipped = 0
  let minDate: string | null = null
  let maxDate: string | null = null
  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = aoa[r]
    if (!row || row.every((v) => v == null || v === '')) continue
    const d = parseDate(get(row, ix.d))
    const c = str(get(row, ix.c))
    if (!d || !c) {
      skipped++
      continue
    }
    const n = str(get(row, ix.n))
    rows.push({
      d,
      f: str(get(row, ix.f)),
      c,
      cn: str(get(row, ix.cn)) || c,
      s: str(get(row, ix.s)) || '(tanpa salesman)',
      k: str(get(row, ix.k)) || n,
      n,
      br: str(get(row, ix.br)),
      kt: str(get(row, ix.kt)),
      om: parseNumber(get(row, ix.om)),
      q: parseNumber(get(row, ix.q)),
    })
    if (!minDate || d < minDate) minDate = d
    if (!maxDate || d > maxDate) maxDate = d
  }
  return { rows, skipped, minDate, maxDate }
}
