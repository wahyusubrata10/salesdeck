// Analisa detail (drill-down) di atas baris transaksi yang sudah diolah (Row).
import { monthOf, shiftMonth } from './dates'
import type { Ch, Row } from './metrics'

export interface Agg {
  omset: number
  qty: number
  faktur: number
  toko: number
  sku: number
  hari: number
  first: string | null
  last: string | null
}

export function aggregate(rows: Row[]): Agg {
  const f = new Set<string>()
  const c = new Set<string>()
  const k = new Set<string>()
  const d = new Set<string>()
  let omset = 0
  let qty = 0
  let first: string | null = null
  let last: string | null = null
  for (const r of rows) {
    omset += r.v
    qty += r.q
    f.add(`${r.d}|${r.f || r.c}`)
    c.add(r.c)
    k.add(r.k)
    d.add(r.d)
    if (!first || r.d < first) first = r.d
    if (!last || r.d > last) last = r.d
  }
  return { omset, qty, faktur: f.size, toko: c.size, sku: k.size, hari: d.size, first, last }
}

export const inMonth = (rows: Row[], m: string) => rows.filter((r) => r.d.startsWith(m))

export const growth = (now: number, prev: number) => (prev > 0 ? now / prev - 1 : now > 0 ? null : 0)

export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`)) / 86400000)

// Omset per bulan (12 bulan terakhir s/d `upTo`), lengkap dengan bulan kosong.
export function monthly(rows: Row[], upTo: string, n = 12) {
  const by = new Map<string, { omset: number; GT: number; MT: number; toko: Set<string> }>()
  for (const r of rows) {
    const m = monthOf(r.d)
    let e = by.get(m)
    if (!e) by.set(m, (e = { omset: 0, GT: 0, MT: 0, toko: new Set() }))
    e.omset += r.v
    e[r.ch] += r.v
    e.toko.add(r.c)
  }
  const first = [...by.keys()].sort()[0] ?? upTo
  const out: { month: string; omset: number; GT: number; MT: number; toko: number }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const m = shiftMonth(upTo, -i)
    if (m < first) continue
    const e = by.get(m)
    out.push({ month: m, omset: e?.omset ?? 0, GT: e?.GT ?? 0, MT: e?.MT ?? 0, toko: e?.toko.size ?? 0 })
  }
  return out
}

export function daily(rows: Row[], m: string) {
  const by = new Map<string, { omset: number; f: Set<string> }>()
  for (const r of rows) {
    if (!r.d.startsWith(m)) continue
    let e = by.get(r.d)
    if (!e) by.set(r.d, (e = { omset: 0, f: new Set() }))
    e.omset += r.v
    e.f.add(r.f || r.c)
  }
  return [...by.entries()].sort().map(([d, e]) => ({ d, omset: e.omset, faktur: e.f.size }))
}

// Ringkas per kunci (toko, produk, salesman, brand), dibandingkan bulan sebelumnya.
export interface GroupLine {
  key: string
  name: string
  omset: number
  prev: number
  growth: number | null
  qty: number
  faktur: number
  toko: number
  sku: number
  share: number
  last: string | null
  extra: Record<string, string>
}

export function groupLines(
  rows: Row[],
  month: string,
  key: (r: Row) => string,
  name: (r: Row) => string,
  extra?: (r: Row) => Record<string, string>,
): GroupLine[] {
  const prevM = shiftMonth(month, -1)
  const cur = new Map<string, Row[]>()
  const prev = new Map<string, number>()
  const last = new Map<string, string>()
  const info = new Map<string, { name: string; extra: Record<string, string> }>()
  let total = 0
  for (const r of rows) {
    const k = key(r)
    if (!info.has(k)) info.set(k, { name: name(r), extra: extra?.(r) ?? {} })
    if (r.d <= `${month}-31` && (!last.has(k) || r.d > last.get(k)!)) last.set(k, r.d)
    if (r.d.startsWith(month)) {
      let a = cur.get(k)
      if (!a) cur.set(k, (a = []))
      a.push(r)
      total += r.v
    } else if (r.d.startsWith(prevM)) prev.set(k, (prev.get(k) ?? 0) + r.v)
  }
  const keys = new Set([...cur.keys(), ...prev.keys()])
  return [...keys]
    .map((k) => {
      const a = aggregate(cur.get(k) ?? [])
      const p = prev.get(k) ?? 0
      const i = info.get(k)!
      return {
        key: k,
        name: i.name,
        omset: a.omset,
        prev: p,
        growth: growth(a.omset, p),
        qty: a.qty,
        faktur: a.faktur,
        toko: a.toko,
        sku: a.sku,
        share: total ? a.omset / total : 0,
        last: last.get(k) ?? null,
        extra: i.extra,
      }
    })
    .sort((x, y) => y.omset - x.omset)
}

// Status toko dibanding riwayatnya.
export type TokoStatus = 'baru' | 'naik' | 'stabil' | 'turun' | 'berhenti'
export const TOKO_STATUS_LABEL: Record<TokoStatus, string> = {
  baru: 'Baru',
  naik: 'Naik',
  stabil: 'Stabil',
  turun: 'Turun',
  berhenti: 'Tidak order bulan ini',
}

export function tokoStatus(l: GroupLine, firstEver: string | null, month: string): TokoStatus {
  if (!l.omset) return 'berhenti'
  if (firstEver && firstEver.startsWith(month)) return 'baru'
  if (l.growth == null) return 'naik'
  if (l.growth >= 0.1) return 'naik'
  if (l.growth <= -0.1) return 'turun'
  return 'stabil'
}

export const firstSeen = (rows: Row[], key: (r: Row) => string) => {
  const m = new Map<string, string>()
  for (const r of rows) {
    const k = key(r)
    if (!m.has(k) || r.d < m.get(k)!) m.set(k, r.d)
  }
  return m
}

// Toko yang order dalam 3 bulan sebelumnya tapi belum order bulan ini (peluang kunjungan).
export function lapsed(rows: Row[], month: string) {
  const window = [1, 2, 3].map((i) => shiftMonth(month, -i))
  const now = new Set(rows.filter((r) => r.d.startsWith(month)).map((r) => r.c))
  const by = new Map<string, { key: string; name: string; omset3: number; last: string; area?: string; s: string }>()
  for (const r of rows) {
    if (!window.includes(monthOf(r.d)) || now.has(r.c)) continue
    const e = by.get(r.c) ?? { key: r.c, name: r.cn, omset3: 0, last: r.d, area: r.ar, s: r.s }
    e.omset3 += r.v
    if (r.d > e.last) e.last = r.d
    by.set(r.c, e)
  }
  return [...by.values()].sort((a, b) => b.omset3 - a.omset3)
}

// Faktur (nota) beserta isinya.
export interface Invoice {
  id: string
  f: string
  d: string
  c: string
  cn: string
  s: string
  total: number
  lines: Row[]
}

export function invoices(rows: Row[]): Invoice[] {
  const by = new Map<string, Invoice>()
  for (const r of rows) {
    const id = `${r.d}|${r.f || r.c}|${r.c}`
    let e = by.get(id)
    if (!e) by.set(id, (e = { id, f: r.f || '(tanpa no.)', d: r.d, c: r.c, cn: r.cn, s: r.s, total: 0, lines: [] }))
    e.total += r.v
    e.lines.push(r)
  }
  return [...by.values()].sort((a, b) => b.d.localeCompare(a.d) || b.total - a.total)
}

// Komposisi (mis. brand) untuk satu entitas.
export function mix(rows: Row[], key: (r: Row) => string) {
  const m = new Map<string, number>()
  let total = 0
  for (const r of rows) {
    m.set(key(r), (m.get(key(r)) ?? 0) + r.v)
    total += r.v
  }
  return [...m.entries()].map(([name, v]) => ({ name, v, share: total ? v / total : 0 })).sort((a, b) => b.v - a.v)
}

export const channelOfRows = (rows: Row[]): Ch | 'GT+MT' => {
  const s = new Set(rows.map((r) => r.ch))
  return s.size === 1 ? [...s][0] : 'GT+MT'
}
