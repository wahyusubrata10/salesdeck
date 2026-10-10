import { inspectWorkbook, parseWorkbook, type ParseResult, type SheetInfo } from './excel'
import { dedupeHeaders, guessChannel, guessTrx } from './fields'
import type { DistributorConfig, Mapping, SaleRow } from './types'

const norm = (s: string) => s.trim().toUpperCase()

// Cari sheet tanpa peduli spasi di ujung / huruf besar-kecil (mis. "PENJUALAN " vs "PENJUALAN").
export const findSheet = (sheets: SheetInfo[], name?: string) =>
  name ? sheets.find((s) => norm(s.name) === norm(name)) : undefined

export const headersAt = (s: SheetInfo, row: number) => dedupeHeaders(s.top[row] ?? [])

// Apakah semua header yang dipetakan ada di sheet ini?
export function mappingFits(s: SheetInfo, row: number, mapping: Mapping) {
  const hs = headersAt(s, row)
  const used = Object.values(mapping).filter(Boolean) as string[]
  return used.length > 0 && used.every((h) => hs.includes(h))
}

export interface Detection {
  cfg: DistributorConfig
  sheet: SheetInfo
  fits: boolean // pemetaan tersimpan cocok → bisa langsung diproses
}

// Tebak distributor pemilik file dari nama file + struktur sheet.
export function detectDistributor(fileName: string, sheets: SheetInfo[], configs: DistributorConfig[]): Detection | null {
  const fname = norm(fileName)
  let best: (Detection & { score: number }) | null = null
  for (const cfg of configs) {
    const s = findSheet(sheets, cfg.sheet)
    const fits = !!s && mappingFits(s, cfg.headerRow ?? 0, cfg.mapping)
    const hint = !!cfg.fileHint && fname.includes(norm(cfg.fileHint))
    const nameHit = cfg.nama.split(/\s+/).some((w) => w.length >= 4 && fname.includes(norm(w)))
    const score = (fits ? 100 + Object.keys(cfg.mapping).length : 0) + (hint ? 50 : 0) + (nameHit ? 20 : 0)
    if (score > 0 && (!best || score > best.score)) {
      best = { cfg, sheet: s ?? sheets[0], fits, score }
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

// Proses file dengan pemetaan pada cfg; mengembalikan config yang diperbarui + baris data.
export async function ingest(
  buf: ArrayBuffer,
  fileName: string,
  sheets: SheetInfo[],
  cfg: DistributorConfig,
): Promise<IngestResult> {
  const sheet = findSheet(sheets, cfg.sheet)
  if (!sheet) throw new Error(`Sheet "${cfg.sheet}" tidak ada di file ${fileName}`)
  const itemSheet = cfg.itemSource ? findSheet(sheets, cfg.itemSource.sheet) : undefined
  const parse = await parseWorkbook(buf, {
    sheet: sheet.name,
    headerRow: cfg.headerRow ?? 0,
    mapping: cfg.mapping,
    itemSource: cfg.itemSource && itemSheet ? { ...cfg.itemSource, sheet: itemSheet.name } : undefined,
  })
  if (!parse.rows.length) throw new Error('Tidak ada baris valid. Periksa pemetaan kolom Tanggal dan Customer.')

  // Master barang: gabungkan yang baru dipelajari dengan yang sudah ada (tidak pernah dihapus).
  const items = { ...cfg.items }
  let newItems = 0
  for (const [k, it] of Object.entries(parse.items ?? {})) {
    if (!items[k]) newItems++
    items[k] = { ...items[k], ...it }
  }

  const channelMap = { ...cfg.channelMap }
  const trxMap = { ...cfg.trxMap }
  for (const r of parse.rows) {
    const kt = items[r.k]?.channel ?? r.kt
    if (!(kt in channelMap)) channelMap[kt] = guessChannel(kt)
    if (cfg.mapping.jenis && !(r.tx in trxMap)) trxMap[r.tx] = guessTrx(r.tx)
  }

  return {
    rows: parse.rows,
    parse,
    newItems,
    cfg: {
      ...cfg,
      sheet: sheet.name.trim(),
      items,
      channelMap,
      trxMap,
      fileName,
      updatedAt: new Date().toISOString(),
      rowCount: parse.rows.length,
    },
  }
}

export async function readFile(file: File) {
  const buf = await file.arrayBuffer()
  const sheets = await inspectWorkbook(buf)
  return { buf, sheets }
}
