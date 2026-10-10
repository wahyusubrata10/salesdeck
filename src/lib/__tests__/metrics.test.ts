import { describe, expect, it } from 'vitest'
import { timeGone } from '../dates'
import { guessMapping } from '../fields'
import { enrich, summarize } from '../metrics'
import { upgradeConfig } from '../presets'
import { emptyTarget, type DistributorConfig, type SaleRow } from '../types'

const cfg: DistributorConfig = upgradeConfig({
  id: 'dx', nama: 'Tes', mapping: { kategori: 'Kategori', jenis: 'KET' }, channelMap: { POLOS: 'GT', 'NON POLOS': 'MT', '': 'X' },
  defaultChannel: 'GT', brandMap: { 'HILO TRADITIONAL': 'HI LO' }, trxMap: {}, salesmanMap: { 'A - NFI': 'A' }, items: {}, omsetMode: 'kolom',
})
const row = (p: Partial<SaleRow>): SaleRow => ({ d: '2026-07-01', f: 'F1', c: 'C1', cn: 'Toko 1', s: 'A', k: 'K1', n: '', br: 'NUTRISARI', kt: 'POLOS', tx: 'Faktur Penjualan', om: 100, q: 1, ...p })

describe('timeGone', () => {
  it('menghitung hari kerja Senin–Sabtu', () => {
    // Juli 2026: 31 hari, 4 hari Minggu -> 27 HK
    expect(timeGone('2026-07', '2026-08-07')).toMatchObject({ total: 27, elapsed: 27, remaining: 0, ratio: 1 })
    expect(timeGone('2026-07', '2026-07-04').elapsed).toBe(4) // 1–4 Juli (Rabu–Sabtu)
  })
})

describe('summarize', () => {
  const rows = [
    row({}),
    row({ k: 'K2', om: 50 }),
    row({ c: 'C2', f: 'F2', kt: 'NON POLOS', br: 'TS', om: 300 }),
    row({ d: '2026-07-02', f: 'F3', br: 'HILO TRADITIONAL', om: 150 }),
    row({ kt: '', om: 999 }), // diabaikan
    row({ d: '2026-06-30', om: 1000 }), // bulan lain
    row({ tx: 'RETUR PENJUALAN', om: -40 }), // diabaikan (jenis transaksi)
    row({ tx: 'FAKTUR PEMBELIAN', om: 5000 }), // diabaikan
  ]
  const t = { ...emptyTarget(), GT: { omset: 600, ea: 2 }, MT: { omset: 400, ea: 1 } }
  const { rows: prepared, stats } = enrich(cfg, rows)
  const s = summarize(prepared, '2026-07', t, '2026-07-02')

  it('mengabaikan retur/pembelian dan kategori kosong', () => {
    expect(stats.excluded).toBe(3)
  })
  it('memisahkan GT/MT dan mengabaikan kategori X', () => {
    expect(s.omset).toEqual({ GT: 300, MT: 300, total: 600 })
    expect(s.ea).toEqual({ GT: 1, MT: 1, total: 2 })
  })
  it('menghitung %ach, time gone dan estimasi closing', () => {
    expect(s.ach).toBeCloseTo(0.6)
    expect(s.tg.elapsed).toBe(2)
    expect(s.avgOmsetHk).toBe(300) // 600 / 2 hari transaksi
    expect(s.estClosing).toBe(600 + 300 * s.tg.remaining)
  })
  it('EC = faktur unik per hari, assortment = SKU unik per customer GT', () => {
    expect(s.ecHk).toBe(1.5) // 1 Jul: F1,F2 ; 2 Jul: F3
    expect(s.asrtGT).toBe(2)
  })
  it('menerapkan grup brand', () => {
    expect(s.brands.GT.map((b) => [b.brand, b.omset])).toEqual([['NUTRISARI', 150], ['HI LO', 150]])
  })
})

describe('guessMapping', () => {
  it('mengenali header umum dengan nama berbeda', () => {
    const m = guessMapping(['Tgl Faktur', 'No Invoice', 'Kd Outlet', 'Nama Toko', 'Sales', 'Merk', 'Nilai', 'Channel'])
    expect(m).toEqual({
      tanggal: 'Tgl Faktur', faktur: 'No Invoice', kodeCustomer: 'Kd Outlet', namaCustomer: 'Nama Toko',
      salesman: 'Sales', brand: 'Merk', omset: 'Nilai', kategori: 'Channel',
    })
  })
})

describe('mode master barang', () => {
  it('omset = qty × harga NFI, brand & channel dari master', () => {
    const c = upgradeConfig({
      id: 'dy', nama: 'Buntok', mapping: { namaCustomer: 'Nama' }, omsetMode: 'master',
      items: { A: { brand: 'HI LO', channel: 'POLOS', harga: 17000 }, B: { brand: 'TS', channel: 'NON POLOS' } },
    })
    const { rows: r, stats } = enrich(c, [row({ k: 'A', q: 4, om: 76000, br: '', kt: '' }), row({ k: 'B', q: 1, br: '', kt: '' })])
    expect(r.map((x) => [x.b, x.ch, x.v])).toEqual([['HI LO', 'GT', 68000], ['TS', 'MT', 0]])
    expect(stats.unpriced.map((u) => u.k)).toEqual(['B'])
  })
})
