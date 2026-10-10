import { guessChannel, guessTrx } from './fields'
import { customerKey } from './parseCore'
import { monthOf, timeGone, todayYmd, workdaysOfMonth, type TimeGone } from './dates'
import { hasMaster, itemOf } from './masters'
import type { DistributorConfig, ItemInfo, MonthTarget, SaleRow } from './types'
import { emptyTarget } from './types'

export const CHANNELS = ['GT', 'MT'] as const
export type Ch = (typeof CHANNELS)[number]
export const CHANNEL_LABEL: Record<Ch, string> = { GT: 'Traditional (GT)', MT: 'Modern (MT)' }

// Baris yang sudah melewati semua aturan distributor (jenis transaksi, channel, brand, harga).
export interface Row {
  d: string
  f: string
  c: string
  cn: string
  s: string
  k: string
  n: string
  ch: Ch
  b: string // grup brand
  v: number // omset
  q: number // qty
  a?: string // alamat
  ar?: string // area / pasar
}

export interface ItemIssue {
  k: string
  n: string
  rows: number
}

export interface EnrichStats {
  excluded: number // baris diabaikan (jenis transaksi / channel)
  unpriced: ItemIssue[] // barang tanpa harga NFI (mode master)
  unknown: ItemIssue[] // barang yang tidak ada di master (brand/channel tidak diketahui)
}

export const rawChannel = (cfg: DistributorConfig, r: SaleRow) => itemOf(cfg, r.k)?.channel || r.kt
export const rawBrand = (cfg: DistributorConfig, r: SaleRow) => itemOf(cfg, r.k)?.brand || r.br

export function enrich(cfg: DistributorConfig, rows: SaleRow[]): { rows: Row[]; stats: EnrichStats } {
  const out: Row[] = []
  let excluded = 0
  const unpriced = new Map<string, ItemIssue>()
  const unknown = new Map<string, ItemIssue>()
  const note = (m: Map<string, ItemIssue>, r: SaleRow) => {
    const u = m.get(r.k) ?? { k: r.k, n: r.n, rows: 0 }
    u.rows++
    m.set(r.k, u)
  }
  const noCode = !cfg.mapping.kodeCustomer
  const useMaster = hasMaster(cfg.id) || Object.values(cfg.items).some((i) => i.channel)
  const hasChannel = !!cfg.mapping.kategori || useMaster
  const cache = new Map<string, ItemInfo | undefined>()
  const item = (k: string) => {
    if (!cache.has(k)) cache.set(k, itemOf(cfg, k))
    return cache.get(k)
  }
  for (const r of rows) {
    if (cfg.mapping.jenis && (cfg.trxMap[r.tx] ?? guessTrx(r.tx)) === 'X') {
      excluded++
      continue
    }
    const it = item(r.k)
    // Dicatat sebelum filter channel: barang yang belum dikenal juga belum punya channel.
    if (useMaster && !it?.channel && !r.kt) note(unknown, r)
    let v = r.om
    if (cfg.omsetMode === 'master') {
      if (!it?.harga) note(unpriced, r)
      v = r.q * (it?.harga ?? 0)
    }
    const kt = it?.channel || r.kt
    const ch = hasChannel ? (cfg.channelMap[kt] ?? guessChannel(kt)) : cfg.defaultChannel
    if (ch === 'X') {
      excluded++
      continue
    }
    const br = it?.brand || r.br
    out.push({
      d: r.d, f: r.f, c: noCode ? customerKey(r.cn) : r.c, cn: r.cn, k: r.k, n: r.n || it?.nama || r.k, ch,
      s: cfg.salesmanMap[r.s]?.trim() || r.s,
      b: cfg.brandMap[br]?.trim() || br || 'LAINNYA',
      v,
      q: r.q,
      a: r.a,
      ar: r.ar,
    })
  }
  const sort = (m: Map<string, ItemIssue>) => [...m.values()].sort((a, b) => b.rows - a.rows)
  return { rows: out, stats: { excluded, unpriced: sort(unpriced), unknown: sort(unknown) } }
}

export interface Filter {
  salesman?: string
  brand?: string
  ch?: Ch
}

export const isFiltered = (f: Filter) => !!(f.salesman || f.brand || f.ch)

export const applyFilter = (rows: Row[], f: Filter) =>
  isFiltered(f)
    ? rows.filter((r) => (!f.salesman || r.s === f.salesman) && (!f.brand || r.b === f.brand) && (!f.ch || r.ch === f.ch))
    : rows

export interface BrandLine {
  brand: string
  omset: number
  ea: number
  tOmset: number
  tEa: number
}

export interface SalesmanLine {
  name: string
  GT: number
  MT: number
  total: number
  ea: number
  ecHk: number
}

export interface DailyPoint {
  d: string
  omset: number
  cum: number | null
  targetCum: number
}

export interface MonthSummary {
  month: string
  omset: Record<Ch, number> & { total: number }
  target: Record<Ch, number> & { total: number }
  ea: Record<Ch, number> & { total: number }
  tEa: Record<Ch, number> & { total: number }
  ach: number | null // omset / target
  tg: TimeGone
  gapTg: number | null // ach - time gone
  sellingDays: number
  avgOmsetHk: number
  estClosing: number
  ecHk: number
  tEcHk: number
  asrtGT: number
  tAsrt: number
  asrtByBrandGT: { brand: string; v: number; t: number }[]
  brands: Record<Ch, BrandLine[]>
  salesmen: SalesmanLine[]
  daily: DailyPoint[]
  topToko: { c: string; cn: string; omset: number; sku: number }[]
  lastDate: string | null
  rowCount: number
}

const avgDistinctPer = (groups: Map<string, Set<string>>) => {
  if (!groups.size) return 0
  let sum = 0
  groups.forEach((s) => (sum += s.size))
  return sum / groups.size
}

const addTo = <K>(m: Map<K, Set<string>>, k: K, v: string) => {
  let s = m.get(k)
  if (!s) m.set(k, (s = new Set()))
  s.add(v)
}

export function summarize(
  allRows: Row[],
  month: string,
  target: MonthTarget = emptyTarget(),
  today = todayYmd(),
): MonthSummary {
  const rows = allRows.filter((r) => monthOf(r.d) === month)
  const omset = { GT: 0, MT: 0, total: 0 }
  const custByCh = { GT: new Set<string>(), MT: new Set<string>() }
  const brandAgg = { GT: new Map<string, { om: number; cust: Set<string> }>(), MT: new Map<string, { om: number; cust: Set<string> }>() }
  const dayOmset = new Map<string, number>()
  const dayFaktur = new Map<string, Set<string>>()
  const skuPerCustGT = new Map<string, Set<string>>()
  const skuPerCustBrandGT = new Map<string, Map<string, Set<string>>>()
  const sales = new Map<string, { GT: number; MT: number; cust: Set<string>; dayFak: Map<string, Set<string>> }>()
  const toko = new Map<string, { cn: string; om: number; sku: Set<string> }>()
  let lastDate: string | null = null
  let rowCount = 0

  for (const r of rows) {
    const ch = r.ch
    rowCount++
    const brand = r.b
    const fak = r.f || r.c
    omset[ch] += r.v
    omset.total += r.v
    custByCh[ch].add(r.c)

    let b = brandAgg[ch].get(brand)
    if (!b) brandAgg[ch].set(brand, (b = { om: 0, cust: new Set() }))
    b.om += r.v
    b.cust.add(r.c)

    dayOmset.set(r.d, (dayOmset.get(r.d) ?? 0) + r.v)
    addTo(dayFaktur, r.d, fak)
    if (!lastDate || r.d > lastDate) lastDate = r.d

    if (ch === 'GT' && r.k) {
      addTo(skuPerCustGT, r.c, r.k)
      let m = skuPerCustBrandGT.get(brand)
      if (!m) skuPerCustBrandGT.set(brand, (m = new Map()))
      addTo(m, r.c, r.k)
    }

    let s = sales.get(r.s)
    if (!s) sales.set(r.s, (s = { GT: 0, MT: 0, cust: new Set(), dayFak: new Map() }))
    s[ch] += r.v
    s.cust.add(r.c)
    addTo(s.dayFak, r.d, fak)

    let t = toko.get(r.c)
    if (!t) toko.set(r.c, (t = { cn: r.cn, om: 0, sku: new Set() }))
    t.om += r.v
    if (r.k) t.sku.add(r.k)
  }

  const tg = timeGone(month, today)
  const targetTotal = target.GT.omset + target.MT.omset
  const ach = targetTotal > 0 ? omset.total / targetTotal : null
  const sellingDays = [...dayOmset.values()].filter((v) => v > 0).length
  const avgOmsetHk = sellingDays ? omset.total / sellingDays : 0
  const estClosing = omset.total + avgOmsetHk * tg.remaining

  const brands = {} as Record<Ch, BrandLine[]>
  for (const ch of CHANNELS) {
    const names = new Set<string>([...brandAgg[ch].keys()])
    for (const key of Object.keys(target.brand)) {
      const [c, name] = key.split('|')
      if (c === ch && (target.brand[key].omset || target.brand[key].ea)) names.add(name)
    }
    brands[ch] = [...names]
      .map((brand) => {
        const a = brandAgg[ch].get(brand)
        const t = target.brand[`${ch}|${brand}`]
        return { brand, omset: a?.om ?? 0, ea: a?.cust.size ?? 0, tOmset: t?.omset ?? 0, tEa: t?.ea ?? 0 }
      })
      .sort((x, y) => y.omset - x.omset)
  }

  const avgPerDay = (m: Map<string, Set<string>>) => avgDistinctPer(m)

  const workdays = workdaysOfMonth(month)
  const allDays = [...new Set([...workdays, ...dayOmset.keys()])].sort()
  let cum = 0
  let wdIdx = 0
  const daily: DailyPoint[] = allDays.map((d) => {
    cum += dayOmset.get(d) ?? 0
    if (workdays.includes(d)) wdIdx++
    return {
      d,
      omset: dayOmset.get(d) ?? 0,
      cum: lastDate && d <= lastDate ? cum : null,
      targetCum: workdays.length ? (targetTotal * wdIdx) / workdays.length : 0,
    }
  })

  return {
    month,
    omset,
    target: { GT: target.GT.omset, MT: target.MT.omset, total: targetTotal },
    ea: { GT: custByCh.GT.size, MT: custByCh.MT.size, total: custByCh.GT.size + custByCh.MT.size },
    tEa: { GT: target.GT.ea, MT: target.MT.ea, total: target.GT.ea + target.MT.ea },
    ach,
    tg,
    gapTg: ach == null ? null : ach - tg.ratio,
    sellingDays,
    avgOmsetHk,
    estClosing,
    ecHk: avgPerDay(dayFaktur),
    tEcHk: target.ecHk,
    asrtGT: avgDistinctPer(skuPerCustGT),
    tAsrt: target.asrt,
    asrtByBrandGT: [...skuPerCustBrandGT.entries()]
      .map(([brand, m]) => ({ brand, v: avgDistinctPer(m), t: target.asrtBrand?.[brand] ?? 0 }))
      .sort((a, b) => b.t - a.t || b.v - a.v),
    brands,
    salesmen: [...sales.entries()]
      .map(([name, s]) => ({ name, GT: s.GT, MT: s.MT, total: s.GT + s.MT, ea: s.cust.size, ecHk: avgPerDay(s.dayFak) }))
      .sort((a, b) => b.total - a.total),
    daily,
    topToko: [...toko.entries()]
      .map(([c, t]) => ({ c, cn: t.cn, omset: t.om, sku: t.sku.size }))
      .sort((a, b) => b.omset - a.omset)
      .slice(0, 10),
    lastDate,
    rowCount,
  }
}

export interface MonthTotal {
  month: string
  GT: number
  MT: number
  total: number
}

export function monthlyTotals(rows: Row[]): MonthTotal[] {
  const m = new Map<string, MonthTotal>()
  for (const r of rows) {
    const k = monthOf(r.d)
    let t = m.get(k)
    if (!t) m.set(k, (t = { month: k, GT: 0, MT: 0, total: 0 }))
    t[r.ch] += r.v
    t.total += r.v
  }
  return [...m.values()].sort((a, b) => a.month.localeCompare(b.month))
}

// Kontribusi omset per brand dalam beberapa bulan terakhir (untuk membagi target).
export function brandShares(rows: Row[], months: string[]): Record<string, number> {
  const set = new Set(months)
  const tot: Record<Ch, number> = { GT: 0, MT: 0 }
  const by: Record<string, number> = {}
  for (const r of rows) {
    if (!set.has(monthOf(r.d))) continue
    const key = `${r.ch}|${r.b}`
    by[key] = (by[key] ?? 0) + r.v
    tot[r.ch] += r.v
  }
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(by)) {
    const ch = k.split('|')[0] as Ch
    out[k] = tot[ch] ? v / tot[ch] : 0
  }
  return out
}
