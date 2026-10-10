import { inspectWorkbook, parseWorkbook, type ParseResult, type SheetInfo } from './excel'
import { dedupeHeaders, guessChannel, guessTrx } from './fields'
import type { DistributorConfig, Mapping, SaleRow } from './types'

const norm = (s: string) => s.trim().toUpperCase()

// Cari sheet tanpa peduli spasi di ujung / huruf besar-kecil (mis. "PENJUALAN " vs "PENJUALAN").
export const findSheet = (sheets: SheetInfo[], name?: string) =>
  name ? sheets.find((s) => norm(s.name) === norm(name)) : undefined

export const headersAt = (s: SheetInfo, row: number) => dedupeHeaders(s.top[row] ?? [])

// Kolom minimum agar file bisa diolah dengan pemetaan ini.
const coreFields = (cfg: DistributorConfig) =>
  (['tanggal', 'kodeCustomer', 'namaCustomer', cfg.omsetMode === 'master' ? 'qty' : 'omset', 'kodeBarang'] as const)
    .map((k) => cfg.mapping[k])
    .filter(Boolean) as string[]

// Seberapa cocok sheet (pada baris header tertentu) dengan pemetaan: 0..1, 0 bila kolom inti tidak ada.
export function fitScore(s: SheetInfo, row: number, cfg: DistributorConfig) {
  const hs = headersAt(s, row)
  const used = Object.values(cfg.mapping).filter(Boolean) as string[]
  if (!used.length || !coreFields(cfg).every((h) => hs.includes(h))) return 0
  return used.filter((h) => hs.includes(h)).length / used.length
}

export interface Detection {
  cfg: DistributorConfig
  sheet: SheetInfo
  headerRow: number
  fits: boolean // pemetaan tersimpan cocok -> bisa langsung diproses
}

// Cari sheet + baris header yang paling cocok untuk sebuah pemetaan (nama sheet boleh berbeda).
export function locate(sheets: SheetInfo[], cfg: DistributorConfig) {
  let best: { sheet: SheetInfo; headerRow: number; score: number } | null = null
  for (const s of sheets) {
    const sameName = norm(s.name) === norm(cfg.sheet ?? '')
    for (const row of new Set([cfg.headerRow ?? 0, s.headerRow])) {
      const sc = fitScore(s, row, cfg) + (sameName ? 0.01 : 0)
      if (sc > 0.01 && (!best || sc > best.score)) best = { sheet: s, headerRow: row, score: sc }
    }
  }
  return best
}

// Tebak distributor pemilik file dari judul kolom (utama) + nama file.
export function detectDistributor(fileName: string, sheets: SheetInfo[], configs: DistributorConfig[]): Detection | null {
  const fname = norm(fileName)
  let best: (Detection & { score: number }) | null = null
  for (const cfg of configs) {
    const loc = locate(sheets, cfg)
    const fits = !!loc && loc.score >= 0.7
    const hint = !!cfg.fileHint && fname.includes(norm(cfg.fileHint))
    const nameHit = cfg.nama.split(/\s+/).some((w) => w.length >= 4 && fname.includes(norm(w)))
    const score = (fits ? 100 * loc!.score : 0) + (hint ? 20 : 0) + (nameHit ? 10 : 0)
    if (score > 0 && (!best || score > best.score)) {
      best = { cfg, sheet: loc?.sheet ?? sheets[0], headerRow: loc?.headerRow ?? cfg.headerRow ?? 0, fits, score }
    }
  }
  return best
}

export interface IngestResult {
  cfg: DistributorConfig
  rows: SaleRow[]
  parse: ParseResult
  newItems: number
}

// Proses file dengan pemetaan pada cfg; mengembalikan config yang diperbarui + baris data dari file.
export async function ingest(
  buf: ArrayBuffer,
  fileName: string,
  sheets: SheetInfo[],
  cfg: DistributorConfig,
): Promise<IngestResult> {
  const loc = locate(sheets, cfg)
  const sheet = loc?.sheet ?? findSheet(sheets, cfg.sheet)
  if (!sheet) throw new Error(`Kolom yang dibutuhkan tidak ditemukan di file ${fileName}`)
  const headerRow = loc?.headerRow ?? cfg.headerRow ?? 0
  // Kolom opsional yang tidak ada di file ini dilewati.
  const hs = headersAt(sheet, headerRow)
  const mapping: Mapping = Object.fromEntries(Object.entries(cfg.mapping).filter(([, h]) => h && hs.includes(h)))
  const itemSheet = cfg.itemSource ? findSheet(sheets, cfg.itemSource.sheet) : undefined
  const parse = await parseWorkbook(buf, {
    sheet: sheet.name,
    headerRow,
    mapping,
    itemSource: cfg.itemSource && itemSheet ? { ...cfg.itemSource, sheet: itemSheet.name } : undefined,
  })
  if (!parse.rows.length) throw new Error('Tidak ada baris valid. Periksa pemetaan kolom Tanggal dan Customer.')

  // Master barang dari file (bila ada): gabungkan dengan yang sudah ada (tidak pernah dihapus).
  const items = { ...cfg.items }
  let newItems = 0
  for (const [k, it] of Object.entries(parse.items ?? {})) {
    if (!items[k]) newItems++
    items[k] = { ...items[k], ...it }
  }

  const channelMap = { ...cfg.channelMap }
  const trxMap = { ...cfg.trxMap }
  for (const r of parse.rows) {
    if (r.kt && !(r.kt in channelMap)) channelMap[r.kt] = guessChannel(r.kt)
    if (cfg.mapping.jenis && !(r.tx in trxMap)) trxMap[r.tx] = guessTrx(r.tx)
  }

  return {
    rows: parse.rows,
    parse,
    newItems,
    cfg: { ...cfg, items, channelMap, trxMap, fileName, updatedAt: new Date().toISOString(), rowCount: parse.rows.length },
  }
}

// Gabungkan data baru: rentang tanggal di file baru menggantikan data lama pada rentang yang sama,
// data di luar rentang itu tetap. File harian, mingguan, maupun kumulatif sama-sama aman.
export function mergeRows(existing: SaleRow[], incoming: SaleRow[]): SaleRow[] {
  if (!incoming.length) return existing
  let min = incoming[0].d
  let max = incoming[0].d
  for (const r of incoming) {
    if (r.d < min) min = r.d
    if (r.d > max) max = r.d
  }
  // Seluruh rentang tanggal file dianggap baru (hari tanpa transaksi di file = memang kosong).
  return existing.filter((r) => r.d < min || r.d > max).concat(incoming)
}

export async function readFile(file: File) {
  const buf = await file.arrayBuffer()
  const sheets = await inspectWorkbook(buf)
  return { buf, sheets }
}
