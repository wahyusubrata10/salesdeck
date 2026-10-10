// Uji integrasi dengan file Excel asli. Tidak ikut di-commit (data penjualan);
// jalankan dengan: SAMPLE_XLSX=/path/ke/file.xlsx npm test
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { guessMapping } from '../fields'
import { summarize } from '../metrics'
import { rankSheets } from '../excel'
import { inspect, parse } from '../parseCore'
import type { DistributorConfig } from '../types'

const file = process.env.SAMPLE_XLSX

describe.skipIf(!file)('file contoh SJA Barabai', () => {
  it('angka Juli 2026 sama dengan sheet Dashboard', () => {
    const b = readFileSync(file!)
    const buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
    const best = rankSheets(inspect(buf))[0]
    expect(best.name).toBe('Database')
    const mapping = guessMapping(best.headers)
    expect(mapping).toMatchObject({ tanggal: 'Tanggal', omset: 'Jumlah (Rp)', kodeCustomer: 'Kode Customer', faktur: 'No. Faktur', brand: 'Brand', kategori: 'Kategori' })
    const { rows } = parse(buf, best.name, best.headerRow, mapping)
    const cfg: DistributorConfig = { id: 'd1', nama: 'SJA', mapping, channelMap: { POLOS: 'GT', 'NON POLOS': 'MT', '': 'X' }, defaultChannel: 'GT', brandMap: {} }
    const s = summarize(cfg, rows, '2026-07', undefined, '2026-08-07')
    expect(s.omset.GT).toBeCloseTo(337336066.46, 0)
    expect(s.omset.MT).toBeCloseTo(120166821.97, 0)
    expect(s.ea).toMatchObject({ GT: 491, MT: 89 })
    const gt = Object.fromEntries(s.brands.GT.map((x) => [x.brand, [Math.round(x.omset), x.ea]]))
    expect(gt.NUTRISARI).toEqual([207297647, 370])
    expect(gt['HI LO']).toEqual([84955157, 233])
    expect(gt.TS).toEqual([36854410, 97])
    console.log({ ecHk: s.ecHk, asrt: s.asrtGT, avgHk: s.avgOmsetHk, asrtBrand: s.asrtByBrandGT })
  }, 60000)
})
