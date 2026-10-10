// Uji integrasi dengan file Excel asli distributor (tidak ikut di-commit karena berisi data penjualan).
// Jalankan dengan: SAMPLE_DIR=/folder/berisi/file-excel npm test
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectDistributor, findSheet } from '../ingest'
import { enrich, summarize } from '../metrics'
import { inspect, parse } from '../parseCore'
import { PRESETS } from '../presets'

const dir = process.env.SAMPLE_DIR
const files = dir ? readdirSync(dir).filter((f) => f.endsWith('.xlsx')) : []

function load(hint: string) {
  const name = files.find((f) => f.toUpperCase().includes(hint))
  if (!name) return null
  const b = readFileSync(join(dir!, name))
  const buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
  const sheets = inspect(buf)
  const det = detectDistributor(name, sheets, PRESETS)
  expect(det?.fits, `preset cocok untuk ${name}`).toBe(true)
  const cfg = structuredClone(det!.cfg)
  const itemSheet = cfg.itemSource ? findSheet(sheets, cfg.itemSource.sheet) : undefined
  const res = parse(buf, {
    sheet: findSheet(sheets, cfg.sheet)!.name,
    headerRow: cfg.headerRow ?? 0,
    mapping: cfg.mapping,
    itemSource: cfg.itemSource && itemSheet ? { ...cfg.itemSource, sheet: itemSheet.name } : undefined,
  })
  cfg.items = { ...cfg.items, ...res.items }
  return { cfg, ...enrich(cfg, res.rows) }
}

const brandMap = (lines: { brand: string; omset: number; ea: number }[]) =>
  Object.fromEntries(lines.map((x) => [x.brand, [Math.round(x.omset), x.ea]]))

describe.skipIf(!files.length)('file contoh distributor (angka = sheet Dashboard)', () => {
  it('SJA Barabai, Juli 2026', () => {
    const d = load('BARABAI')!
    expect(d.cfg.id).toBe('d1')
    const s = summarize(d.rows, '2026-07', undefined, '2026-08-07')
    expect(s.omset.GT).toBeCloseTo(337336066.46, 0)
    expect(s.omset.MT).toBeCloseTo(120166821.97, 0)
    expect(s.ea).toMatchObject({ GT: 491, MT: 89 })
    // Di preset, brand "HILO TRADITIONAL" digabung ke HI LO (84.955.157 + 8.228.852).
    expect(brandMap(s.brands.GT)).toMatchObject({ NUTRISARI: [207297647, 370], TS: [36854410, 97] })
    expect(brandMap(s.brands.GT)['HI LO'][0]).toBe(84955157 + 8228852)
  }, 60000)

  it('Teweh, September 2026', () => {
    const d = load('TEWEH')!
    expect(d.cfg.id).toBe('d2')
    const s = summarize(d.rows, '2026-09')
    expect(Math.round(s.omset.GT)).toBe(39111865)
    expect(Math.round(s.omset.MT)).toBe(43120615)
    expect(s.ea).toMatchObject({ GT: 42, MT: 26 })
    expect(s.ecHk).toBeCloseTo(3.087, 2)
    expect(brandMap(s.brands.GT)).toMatchObject({ NUTRISARI: [23694540, 27], 'HI LO': [15417325, 32] })
    expect(brandMap(s.brands.MT)).toMatchObject({ 'HI LO': [14776077, 17], TS: [23969455, 18], 'L-MEN': [4375083, 3] })
  }, 60000)

  it('Buntok, September 2026 (dari sheet PENJUALAN mentah)', () => {
    const d = load('BUNTOK')!
    expect(d.cfg.id).toBe('d3')
    expect(d.stats.unpriced).toEqual([])
    const s = summarize(d.rows, '2026-09')
    expect(Math.round(s.omset.GT)).toBe(29175000)
    expect(Math.round(s.omset.MT)).toBe(16014300)
    expect(s.ecHk).toBeCloseTo(4.333, 2)
    expect(brandMap(s.brands.GT)['NUTRISARI'][0]).toBe(14640000)
    expect(brandMap(s.brands.GT)['HI LO'][0]).toBe(14535000)
    expect(brandMap(s.brands.MT)).toMatchObject({ 'HI LO': [8849000, expect.any(Number)], TS: [5392100, expect.any(Number)] })
    // Kode customer = nama tanpa spasi ("B7 DS LINA" -> "b7dslina"). Excel memotong nama jadi "B7DS"
    // sehingga banyak toko tergabung (EA Excel 28/8).
    expect(d.rows[0].c).toBe('b7dslina')
    expect(s.ea).toMatchObject({ GT: 51, MT: 25 })
  }, 60000)

  it('Tanjung, September 2026 (hanya faktur penjualan)', () => {
    const d = load('TANJUNG')!
    expect(d.cfg.id).toBe('d4')
    const s = summarize(d.rows, '2026-09')
    expect(s.omset.GT).toBeCloseTo(211152150.7, 0)
    expect(s.omset.MT).toBeCloseTo(115033604.5, 0)
    expect(s.ea).toMatchObject({ GT: 311, MT: 78 })
    expect(s.ecHk).toBeCloseTo(16.115, 2)
    expect(s.asrtGT).toBeCloseTo(4.331, 2)
    expect(brandMap(s.brands.GT)).toMatchObject({ NUTRISARI: [136373733, 249], 'HI LO': [61724038, 114], TS: [13054380, 45] })
  }, 120000)
})
