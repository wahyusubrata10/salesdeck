import { useMemo, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { aggregate, daily, daysBetween, growth, groupLines, inMonth, invoices, lapsed, mix, monthly, type GroupLine } from '../../lib/analysis'
import { SERIES } from '../../lib/colors'
import { dateLabel, monthLabel, shiftMonth } from '../../lib/dates'
import { dec, num, pct, rp, rpShort } from '../../lib/format'
import type { Row } from '../../lib/metrics'
import DataTable, { type Column } from '../DataTable'
import { ChartTip } from '../ui'
import { useDetail, type DetailKind, type DetailRef } from './context'

const KIND_LABEL: Record<DetailKind, string> = {
  toko: 'Toko', produk: 'Produk', salesman: 'Salesman', brand: 'Brand', hari: 'Harian', faktur: 'Faktur', area: 'Area',
}

export default function DetailView({ refx, month, setMonth }: { refx: DetailRef; month: string; setMonth: (m: string) => void }) {
  const { prepared, configs } = useDetail()
  const cfg = configs.find((c) => c.id === refx.dist)
  const color = SERIES[Math.max(0, configs.findIndex((c) => c.id === refx.dist))]
  const all = useMemo(() => prepared[refx.dist]?.rows ?? [], [prepared, refx.dist])
  const ent = useMemo(() => {
    const id = refx.id
    switch (refx.kind) {
      case 'toko': return all.filter((r) => r.c === id)
      case 'produk': return all.filter((r) => r.k === id)
      case 'salesman': return all.filter((r) => r.s === id)
      case 'brand': return all.filter((r) => r.b === id)
      case 'area': return all.filter((r) => (r.ar || '(tanpa area)') === id)
      case 'hari': return all.filter((r) => r.d === id)
      case 'faktur': return all.filter((r) => `${r.d}|${r.f || r.c}|${r.c}` === id)
    }
  }, [all, refx])
  const dataEnd = useMemo(() => all.reduce((m, r) => (r.d > m ? r.d : m), ''), [all])

  if (!cfg) return null
  const common = { refx, rows: ent, month, setMonth, color, distName: cfg.nama, dataEnd }
  switch (refx.kind) {
    case 'toko': return <TokoDetail {...common} />
    case 'produk': return <ProdukDetail {...common} />
    case 'salesman':
    case 'area': return <SalesmanDetail {...common} />
    case 'brand': return <BrandDetail {...common} />
    case 'hari': return <HariDetail {...common} />
    case 'faktur': return <FakturDetail {...common} />
  }
}

interface P {
  refx: DetailRef
  rows: Row[]
  month: string
  setMonth: (m: string) => void
  color: string
  distName: string
  dataEnd: string
}

// ---------- potongan bersama ----------

function Head({ refx, title, sub, distName, color, month, setMonth, noMonth }: {
  refx: DetailRef; title: ReactNode; sub?: ReactNode; distName: string; color: string; month?: string; setMonth?: (m: string) => void; noMonth?: boolean
}) {
  return (
    <header className="d-head">
      <div className="d-kind">
        <span className="chip"><span className="swatch" style={{ background: color }} />{distName}</span>
        <span className="chip ghost">{KIND_LABEL[refx.kind]}</span>
      </div>
      <h2 className="d-title">{title}</h2>
      {sub && <div className="d-sub">{sub}</div>}
      {!noMonth && month && setMonth && (
        <div className="month-switch">
          <button className="btn ghost icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Bulan sebelumnya">‹</button>
          <b>{monthLabel(month, true)}</b>
          <button className="btn ghost icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Bulan berikutnya">›</button>
        </div>
      )}
    </header>
  )
}

export function Delta({ g, small }: { g: number | null; small?: boolean }) {
  if (g == null) return <span className={`delta new${small ? ' sm' : ''}`}>baru</span>
  if (!isFinite(g) || Math.abs(g) < 0.0005) return <span className={`delta flat${small ? ' sm' : ''}`}>0%</span>
  return <span className={`delta ${g > 0 ? 'up' : 'down'}${small ? ' sm' : ''}`}>{g > 0 ? '▲' : '▼'} {pct(Math.abs(g))}</span>
}

function Stat({ label, value, delta, sub }: { label: string; value: ReactNode; delta?: number | null; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="sub">{delta !== undefined && <Delta g={delta} small />} {sub}</div>
    </div>
  )
}

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="d-sec">
      <div className="section-title"><h3>{title}</h3>{right}</div>
      {children}
    </section>
  )
}

function MonthBars({ rows, month, setMonth, color }: { rows: Row[]; month: string; setMonth: (m: string) => void; color: string }) {
  const data = useMemo(() => monthly(rows, month, 12), [rows, month])
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }} onClick={(e) => e?.activeLabel && setMonth(String(e.activeLabel))}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m).slice(0, 3)} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
        <YAxis tickFormatter={rpShort} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={52} />
        <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip fmt={rp} labelFmt={(m) => monthLabel(m, true)} />} />
        <Bar dataKey="omset" name="Omset" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }}>
          {data.map((d) => <Cell key={d.month} fill={color} fillOpacity={d.month === month ? 1 : 0.35} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function DayBars({ rows, month, color, onDay }: { rows: Row[]; month: string; color: string; onDay?: (d: string) => void }) {
  const data = useMemo(() => daily(rows, month), [rows, month])
  if (!data.length) return <div className="empty small">Tidak ada transaksi di bulan ini</div>
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }} onClick={(e) => e?.activeLabel && onDay?.(String(e.activeLabel))}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="d" tickFormatter={(d) => String(+d.slice(8))} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} minTickGap={6} />
        <YAxis tickFormatter={rpShort} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={52} />
        <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip fmt={rp} labelFmt={dateLabel} />} />
        <Bar dataKey="omset" name="Omset" fill={color} radius={[3, 3, 0, 0]} style={{ cursor: onDay ? 'pointer' : undefined }} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function MixList({ rows, by, onPick }: { rows: Row[]; by: (r: Row) => string; onPick?: (k: string) => void }) {
  const items = useMemo(() => mix(rows, by), [rows, by])
  if (!items.length) return <div className="empty small">–</div>
  return (
    <ul className="mix">
      {items.slice(0, 8).map((m) => (
        <li key={m.name} className={onPick ? 'clickable' : undefined} onClick={() => onPick?.(m.name)}>
          <span className="mix-name">{m.name}</span>
          <span className="mix-bar"><i style={{ width: `${Math.max(2, m.share * 100)}%` }} /></span>
          <span className="mix-val">{rpShort(m.v)} <span className="muted">· {pct(m.share)}</span></span>
        </li>
      ))}
    </ul>
  )
}

const lineCols = (label: string, opts: { qty?: boolean; toko?: boolean; sku?: boolean; last?: boolean } = {}): Column<GroupLine>[] => [
  { key: 'name', label, wide: true, render: (l) => <span className="link">{l.name}</span>, sort: (l) => l.name },
  { key: 'omset', label: 'Omset', num: true, render: (l) => rp(l.omset), sort: (l) => l.omset },
  { key: 'g', label: 'vs bln lalu', num: true, render: (l) => <Delta g={l.growth} small />, sort: (l) => l.growth ?? 9 },
  ...(opts.qty ? [{ key: 'qty', label: 'Qty', num: true, hideSm: true, render: (l: GroupLine) => num(l.qty), sort: (l: GroupLine) => l.qty }] : []),
  ...(opts.toko ? [{ key: 'toko', label: 'Toko', num: true, render: (l: GroupLine) => num(l.toko), sort: (l: GroupLine) => l.toko }] : []),
  ...(opts.sku ? [{ key: 'sku', label: 'SKU', num: true, hideSm: true, render: (l: GroupLine) => num(l.sku), sort: (l: GroupLine) => l.sku }] : []),
  ...(opts.last ? [{ key: 'last', label: 'Terakhir', num: true, hideSm: true, render: (l: GroupLine) => (l.last ? dateLabel(l.last) : '–'), sort: (l: GroupLine) => l.last ?? '' }] : []),
]

function useOpen(dist: string) {
  const { open } = useDetail()
  return (kind: DetailKind, id: string, title?: string) => open({ kind, dist, id, title })
}

// ---------- jenis detail ----------

function TokoDetail({ refx, rows, month, setMonth, color, distName, dataEnd }: P) {
  const go = useOpen(refx.dist)
  const cur = useMemo(() => inMonth(rows, month), [rows, month])
  const prev = useMemo(() => inMonth(rows, shiftMonth(month, -1)), [rows, month])
  const a = aggregate(cur)
  const p = aggregate(prev)
  const life = aggregate(rows)
  const latest = rows.reduce<Row | null>((m, r) => (!m || r.d > m.d ? r : m), null)
  const salesmen = [...new Set(rows.map((r) => r.s))]
  const year = month.slice(0, 4)
  const ytd = rows.filter((r) => r.d.startsWith(year) && r.d <= `${month}-31`).reduce((s, r) => s + r.v, 0)
  const activeMonths = new Set(rows.map((r) => r.d.slice(0, 7))).size
  const produk = useMemo(() => groupLines(rows, month, (r) => r.k, (r) => r.n), [rows, month])
  const inv = useMemo(() => invoices(cur), [cur])
  const since = life.last && dataEnd ? daysBetween(life.last, dataEnd) : null

  return (
    <>
      <Head refx={refx} distName={distName} color={color} month={month} setMonth={setMonth}
        title={latest?.cn ?? refx.title ?? refx.id}
        sub={<>
          <span>Kode {refx.id}</span>
          {latest?.a && <span>· {latest.a}</span>}
          {latest?.ar && <span>· <button className="link" onClick={() => go('area', latest.ar!)}>{latest.ar}</button></span>}
          {salesmen.filter((s) => s !== '(tanpa salesman)').map((s) => <span key={s}>· <button className="link" onClick={() => go('salesman', s)}>{s}</button></span>)}
        </>}
      />
      <div className="stats">
        <Stat label="Omset bulan ini" value={rpShort(a.omset)} delta={growth(a.omset, p.omset)} sub={`bln lalu ${rpShort(p.omset)}`} />
        <Stat label="Faktur" value={num(a.faktur)} sub={a.faktur ? `rata² ${rpShort(a.omset / a.faktur)}/faktur` : undefined} />
        <Stat label="SKU dibeli" value={num(a.sku)} sub={`bln lalu ${num(p.sku)}`} />
        <Stat label={`Total ${year} (s/d bln ini)`} value={rpShort(ytd)} sub={`${activeMonths} bulan aktif`} />
        <Stat label="Terakhir order" value={life.last ? dateLabel(life.last) : '–'} sub={since != null ? (since <= 0 ? 'hari ini/terbaru' : `${since} hari lalu`) : undefined} />
        <Stat label="Pertama order" value={life.first ? dateLabel(life.first) : '–'} sub="(dalam data)" />
      </div>
      <Section title="Omset per bulan" right={<span className="muted small">klik batang untuk pindah bulan</span>}>
        <MonthBars rows={rows} month={month} setMonth={setMonth} color={color} />
      </Section>
      <div className="d-grid">
        <Section title="Brand bulan ini">
          <MixList rows={cur} by={(r) => r.b} onPick={(b) => go('brand', b)} />
        </Section>
        <Section title="Channel">
          <MixList rows={rows.filter((r) => r.d.startsWith(year))} by={(r) => r.ch} />
        </Section>
      </div>
      <Section title="Produk dibeli">
        <DataTable rows={produk} rowKey={(l) => l.key} columns={lineCols('Produk', { qty: true, last: true })}
          onRowClick={(l) => go('produk', l.key, l.name)} search={(l) => `${l.name} ${l.key}`} limit={10} />
      </Section>
      <Section title={`Faktur ${monthLabel(month)}`}>
        <InvoiceList list={inv} onOpen={(i) => go('faktur', i.id, i.f)} />
      </Section>
    </>
  )
}

function ProdukDetail({ refx, rows, month, setMonth, color, distName }: P) {
  const go = useOpen(refx.dist)
  const cur = useMemo(() => inMonth(rows, month), [rows, month])
  const a = aggregate(cur)
  const p = aggregate(inMonth(rows, shiftMonth(month, -1)))
  const first = rows[0]
  const toko = useMemo(() => groupLines(rows, month, (r) => r.c, (r) => r.cn, (r) => ({ area: r.ar ?? '' })), [rows, month])
  const lost = useMemo(() => lapsed(rows, month), [rows, month])
  return (
    <>
      <Head refx={refx} distName={distName} color={color} month={month} setMonth={setMonth}
        title={first?.n ?? refx.title ?? refx.id}
        sub={<>
          <span>Kode {refx.id}</span>
          {first && <span>· <button className="link" onClick={() => go('brand', first.b)}>{first.b}</button></span>}
          {first && <span>· {first.ch}</span>}
        </>}
      />
      <div className="stats">
        <Stat label="Omset" value={rpShort(a.omset)} delta={growth(a.omset, p.omset)} sub={`bln lalu ${rpShort(p.omset)}`} />
        <Stat label="Qty" value={num(a.qty)} delta={growth(a.qty, p.qty)} />
        <Stat label="Toko membeli" value={num(a.toko)} delta={growth(a.toko, p.toko)} sub={`bln lalu ${num(p.toko)}`} />
        <Stat label="Faktur" value={num(a.faktur)} />
      </div>
      <Section title="Omset per bulan"><MonthBars rows={rows} month={month} setMonth={setMonth} color={color} /></Section>
      <Section title="Toko pembeli">
        <DataTable rows={toko} rowKey={(l) => l.key} columns={lineCols('Toko', { qty: true, last: true })}
          onRowClick={(l) => go('toko', l.key, l.name)} search={(l) => `${l.name} ${l.key} ${l.extra.area}`} limit={10} />
      </Section>
      <Section title="Biasa beli, bulan ini belum" right={<span className="muted small">order 3 bulan terakhir</span>}>
        <LapsedList list={lost} onOpen={(c, n) => go('toko', c, n)} />
      </Section>
    </>
  )
}

function SalesmanDetail({ refx, rows, month, setMonth, color, distName }: P) {
  const go = useOpen(refx.dist)
  const cur = useMemo(() => inMonth(rows, month), [rows, month])
  const a = aggregate(cur)
  const p = aggregate(inMonth(rows, shiftMonth(month, -1)))
  const gt = cur.filter((r) => r.ch === 'GT').reduce((s, r) => s + r.v, 0)
  const toko = useMemo(() => groupLines(rows, month, (r) => r.c, (r) => r.cn, (r) => ({ area: r.ar ?? '' })), [rows, month])
  const lost = useMemo(() => lapsed(rows, month), [rows, month])
  const isArea = refx.kind === 'area'
  return (
    <>
      <Head refx={refx} distName={distName} color={color} month={month} setMonth={setMonth} title={refx.id} />
      <div className="stats">
        <Stat label="Omset" value={rpShort(a.omset)} delta={growth(a.omset, p.omset)} sub={`bln lalu ${rpShort(p.omset)}`} />
        <Stat label="GT / MT" value={`${pct(a.omset ? gt / a.omset : null)} GT`} sub={`MT ${rpShort(a.omset - gt)}`} />
        <Stat label="EA (toko aktif)" value={num(a.toko)} delta={growth(a.toko, p.toko)} />
        <Stat label="EC / hari" value={a.hari ? dec(a.faktur / a.hari) : '–'} sub={`${num(a.faktur)} faktur · ${a.hari} hari`} />
        <Stat label="SKU / toko" value={a.toko ? dec(cur.length ? avgSku(cur) : 0) : '–'} />
      </div>
      <Section title="Omset per bulan"><MonthBars rows={rows} month={month} setMonth={setMonth} color={color} /></Section>
      <Section title="Omset harian" right={<span className="muted small">klik batang untuk detail hari</span>}>
        <DayBars rows={rows} month={month} color={color} onDay={(d) => go('hari', d)} />
      </Section>
      <div className="d-grid">
        <Section title="Brand"><MixList rows={cur} by={(r) => r.b} onPick={(b) => go('brand', b)} /></Section>
        {isArea
          ? <Section title="Salesman"><MixList rows={cur} by={(r) => r.s} onPick={(s) => go('salesman', s)} /></Section>
          : <Section title="Area / pasar"><MixList rows={cur} by={(r) => r.ar || '(tanpa area)'} onPick={(x) => go('area', x)} /></Section>}
      </div>
      <Section title="Toko">
        <DataTable rows={toko} rowKey={(l) => l.key} columns={lineCols('Toko', { sku: true, last: true })}
          onRowClick={(l) => go('toko', l.key, l.name)} search={(l) => `${l.name} ${l.key} ${l.extra.area}`} limit={10} />
      </Section>
      <Section title="Toko belum order bulan ini" right={<span className="muted small">order 3 bulan terakhir</span>}>
        <LapsedList list={lost} onOpen={(c, n) => go('toko', c, n)} />
      </Section>
    </>
  )
}

function BrandDetail({ refx, rows, month, setMonth, color, distName }: P) {
  const go = useOpen(refx.dist)
  const cur = useMemo(() => inMonth(rows, month), [rows, month])
  const a = aggregate(cur)
  const p = aggregate(inMonth(rows, shiftMonth(month, -1)))
  const produk = useMemo(() => groupLines(rows, month, (r) => r.k, (r) => r.n), [rows, month])
  const toko = useMemo(() => groupLines(rows, month, (r) => r.c, (r) => r.cn), [rows, month])
  return (
    <>
      <Head refx={refx} distName={distName} color={color} month={month} setMonth={setMonth} title={refx.id} />
      <div className="stats">
        <Stat label="Omset" value={rpShort(a.omset)} delta={growth(a.omset, p.omset)} sub={`bln lalu ${rpShort(p.omset)}`} />
        <Stat label="EA" value={num(a.toko)} delta={growth(a.toko, p.toko)} />
        <Stat label="SKU terjual" value={num(a.sku)} />
        <Stat label="Qty" value={num(a.qty)} />
      </div>
      <Section title="Omset per bulan"><MonthBars rows={rows} month={month} setMonth={setMonth} color={color} /></Section>
      <div className="d-grid">
        <Section title="Channel"><MixList rows={cur} by={(r) => r.ch} /></Section>
        <Section title="Salesman"><MixList rows={cur} by={(r) => r.s} onPick={(s) => go('salesman', s)} /></Section>
      </div>
      <Section title="Produk">
        <DataTable rows={produk} rowKey={(l) => l.key} columns={lineCols('Produk', { qty: true, toko: true })}
          onRowClick={(l) => go('produk', l.key, l.name)} search={(l) => `${l.name} ${l.key}`} limit={10} />
      </Section>
      <Section title="Toko">
        <DataTable rows={toko} rowKey={(l) => l.key} columns={lineCols('Toko', { sku: true, last: true })}
          onRowClick={(l) => go('toko', l.key, l.name)} search={(l) => `${l.name} ${l.key}`} limit={10} />
      </Section>
    </>
  )
}

function HariDetail({ refx, rows, color, distName }: P) {
  const go = useOpen(refx.dist)
  const a = aggregate(rows)
  const inv = useMemo(() => invoices(rows), [rows])
  return (
    <>
      <Head refx={refx} distName={distName} color={color} title={dateLabel(refx.id)} noMonth />
      <div className="stats">
        <Stat label="Omset" value={rpShort(a.omset)} />
        <Stat label="Faktur (EC)" value={num(a.faktur)} />
        <Stat label="Toko" value={num(a.toko)} />
        <Stat label="SKU" value={num(a.sku)} />
      </div>
      <div className="d-grid">
        <Section title="Salesman"><MixList rows={rows} by={(r) => r.s} onPick={(s) => go('salesman', s)} /></Section>
        <Section title="Brand"><MixList rows={rows} by={(r) => r.b} onPick={(b) => go('brand', b)} /></Section>
      </div>
      <Section title="Faktur"><InvoiceList list={inv} onOpen={(i) => go('faktur', i.id, i.f)} showToko onToko={(c, n) => go('toko', c, n)} /></Section>
    </>
  )
}

function FakturDetail({ refx, rows, color, distName }: P) {
  const go = useOpen(refx.dist)
  const inv = invoices(rows)[0]
  if (!inv) return <div className="empty">Faktur tidak ditemukan</div>
  return (
    <>
      <Head refx={refx} distName={distName} color={color} title={`Faktur ${inv.f}`} noMonth
        sub={<>
          <span>{dateLabel(inv.d)}</span>
          <span>· <button className="link" onClick={() => go('toko', inv.c, inv.cn)}>{inv.cn}</button></span>
          {inv.s !== '(tanpa salesman)' && <span>· <button className="link" onClick={() => go('salesman', inv.s)}>{inv.s}</button></span>}
        </>}
      />
      <div className="stats">
        <Stat label="Total" value={rp(inv.total)} />
        <Stat label="Baris barang" value={num(inv.lines.length)} />
      </div>
      <Section title="Isi faktur">
        <DataTable rows={inv.lines} rowKey={(r) => `${r.k}|${r.v}|${r.q}`} limit={100}
          onRowClick={(r) => go('produk', r.k, r.n)}
          columns={[
            { key: 'n', label: 'Produk', wide: true, render: (r) => <span className="link">{r.n}</span>, sort: (r) => r.n },
            { key: 'b', label: 'Brand', hideSm: true, render: (r) => r.b, sort: (r) => r.b },
            { key: 'q', label: 'Qty', num: true, render: (r) => num(r.q), sort: (r) => r.q },
            { key: 'v', label: 'Nilai', num: true, render: (r) => rp(r.v), sort: (r) => r.v },
          ]}
        />
      </Section>
    </>
  )
}

function InvoiceList({ list, onOpen, showToko, onToko }: {
  list: ReturnType<typeof invoices>; onOpen: (i: ReturnType<typeof invoices>[number]) => void; showToko?: boolean; onToko?: (c: string, n: string) => void
}) {
  return (
    <DataTable rows={list} rowKey={(i) => i.id} limit={10} onRowClick={onOpen} empty="Tidak ada faktur"
      search={(i) => `${i.f} ${i.cn}`} searchPlaceholder="Cari no. faktur / toko…"
      columns={[
        { key: 'd', label: 'Tanggal', render: (i) => dateLabel(i.d), sort: (i) => i.d },
        { key: 'f', label: 'No. faktur', render: (i) => <span className="link">{i.f}</span>, sort: (i) => i.f },
        ...(showToko ? [{ key: 'c', label: 'Toko', wide: true, render: (i: ReturnType<typeof invoices>[number]) => <button className="link" onClick={(e) => { e.stopPropagation(); onToko?.(i.c, i.cn) }}>{i.cn}</button>, sort: (i: ReturnType<typeof invoices>[number]) => i.cn }] : []),
        { key: 'l', label: 'Item', num: true, render: (i) => num(i.lines.length), sort: (i) => i.lines.length },
        { key: 't', label: 'Total', num: true, render: (i) => rp(i.total), sort: (i) => i.total },
      ]}
    />
  )
}

function LapsedList({ list, onOpen }: { list: ReturnType<typeof lapsed>; onOpen: (c: string, n: string) => void }) {
  return (
    <DataTable rows={list} rowKey={(l) => l.key} limit={10} onRowClick={(l) => onOpen(l.key, l.name)} empty="Semua toko langganan sudah order 👍"
      columns={[
        { key: 'name', label: 'Toko', wide: true, render: (l) => <span className="link">{l.name}</span>, sort: (l) => l.name },
        { key: 'o', label: 'Omset 3 bln', num: true, render: (l) => rpShort(l.omset3), sort: (l) => l.omset3 },
        { key: 'last', label: 'Terakhir', num: true, render: (l) => dateLabel(l.last), sort: (l) => l.last },
      ]}
    />
  )
}

function avgSku(rows: Row[]) {
  const m = new Map<string, Set<string>>()
  for (const r of rows) {
    let s = m.get(r.c)
    if (!s) m.set(r.c, (s = new Set()))
    s.add(r.k)
  }
  let t = 0
  m.forEach((s) => (t += s.size))
  return m.size ? t / m.size : 0
}
