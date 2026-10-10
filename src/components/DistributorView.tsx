import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { firstSeen, growth, groupLines, inMonth, invoices, lapsed, tokoStatus, TOKO_STATUS_LABEL, type GroupLine, type TokoStatus } from '../lib/analysis'
import { CH_COLOR } from '../lib/colors'
import { dateLabel, monthLabel, shiftMonth } from '../lib/dates'
import { dec, num, pct, ratio, rp, rpShort } from '../lib/format'
import { applyFilter, CHANNEL_LABEL, CHANNELS, isFiltered, monthlyTotals, summarize, type BrandLine, type Ch, type EnrichStats, type Filter, type Row } from '../lib/metrics'
import type { DistributorConfig, MonthTarget } from '../lib/types'
import DataTable, { type Column } from './DataTable'
import { useDetail, type DetailKind } from './detail/context'
import { Delta } from './detail/DetailViews'
import { AchBar, ChartTip, Legend, StatusBadge } from './ui'

interface Props {
  cfg: DistributorConfig
  color: string
  prepared: { rows: Row[]; stats: EnrichStats }
  target?: MonthTarget
  month: string
}

type Tab = 'ikhtisar' | 'toko' | 'produk' | 'salesman' | 'area' | 'transaksi'
type Go = (kind: DetailKind, id: string, title?: string) => void

export default function DistributorView({ cfg, color, prepared, target, month }: Props) {
  const { open } = useDetail()
  const go: Go = (kind, id, title) => open({ kind, dist: cfg.id, id, title })
  const [tab, setTab] = useState<Tab>('ikhtisar')
  const [filter, setFilter] = useState<Filter>({})
  const filtered = isFiltered(filter)
  const rows = useMemo(() => applyFilter(prepared.rows, filter), [prepared.rows, filter])
  // Target hanya berlaku untuk total distributor; saat difilter target disembunyikan.
  const s = useMemo(() => summarize(rows, month, filtered ? undefined : target), [rows, month, target, filtered])
  const prev = useMemo(() => summarize(rows, shiftMonth(month, -1)), [rows, month])
  const options = useMemo(() => {
    const ms = prepared.rows.filter((r) => r.d.startsWith(month))
    return {
      salesman: [...new Set(ms.map((r) => r.s))].sort(),
      brand: [...new Set(ms.map((r) => r.b))].sort(),
    }
  }, [prepared.rows, month])
  const hasSalesman = !!cfg.mapping.salesman
  const hasArea = !!cfg.mapping.area
  const { unpriced, unknown } = prepared.stats
  const hasTarget = s.target.total > 0

  const tabs: [Tab, string][] = [
    ['ikhtisar', 'Ikhtisar'],
    ['toko', 'Toko'],
    ['produk', 'Produk'],
    ...(hasSalesman ? [['salesman', 'Salesman'] as [Tab, string]] : []),
    ...(hasArea ? [['area', 'Area'] as [Tab, string]] : []),
    ['transaksi', 'Transaksi'],
  ]

  return (
    <div className="stack">
      <div className="card hero-card">
        <div className="section-title">
          <h1 className="row" style={{ gap: 10 }}>
            <span className="swatch lg" style={{ background: color }} />
            {cfg.nama}
            <span className="h-sub">{monthLabel(month, true)}</span>
          </h1>
          <span className="muted small">
            {s.lastDate ? `Data s/d ${dateLabel(s.lastDate)}` : 'Tidak ada transaksi di bulan ini'}
            {cfg.updatedAt && ` · diupdate ${new Date(cfg.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`}
          </span>
        </div>
        <div className="kpis">
          <div className="kpi accent">
            <div className="label">Omset</div>
            <div className="hero">{rpShort(s.omset.total)}</div>
            <div className="sub"><Delta g={growth(s.omset.total, prev.omset.total)} small /> vs {monthLabel(shiftMonth(month, -1))}</div>
          </div>
          <div className="kpi">
            <div className="label">Pencapaian target</div>
            <div className="value">{pct(s.ach)}</div>
            <div className="sub">{hasTarget ? <>dari {rpShort(s.target.total)} · <StatusBadge gap={s.gapTg} /></> : filtered ? 'target tidak berlaku saat difilter' : 'target belum diisi'}</div>
            {hasTarget && <AchBar ach={s.ach} tg={s.tg.ratio} />}
          </div>
          <div className="kpi">
            <div className="label">Time gone</div>
            <div className="value">{pct(s.tg.ratio)}</div>
            <div className="sub">HK {s.tg.elapsed}/{s.tg.total} · sisa {s.tg.remaining} HK</div>
          </div>
          <div className="kpi">
            <div className="label">Estimasi closing</div>
            <div className="value">{rpShort(s.estClosing)}</div>
            <div className="sub">{hasTarget ? `${pct(s.estClosing / s.target.total)} dari target` : `rata² ${rpShort(s.avgOmsetHk)}/HK`}</div>
          </div>
          <div className="kpi">
            <div className="label">EA (toko aktif)</div>
            <div className="value">{num(s.ea.total)}</div>
            <div className="sub"><Delta g={growth(s.ea.total, prev.ea.total)} small /> · GT {num(s.ea.GT)} · MT {num(s.ea.MT)}</div>
          </div>
          <div className="kpi">
            <div className="label">EC / HK</div>
            <div className="value">{dec(s.ecHk)}</div>
            <div className="sub"><Delta g={growth(s.ecHk, prev.ecHk)} small /> {s.tEcHk ? `· target ${dec(s.tEcHk)}` : ''}</div>
          </div>
        </div>
      </div>

      {(unpriced.length > 0 || unknown.length > 0) && (
        <div className="notice warn">
          {unknown.length > 0 && <div><b>{unknown.length} barang belum dikenal</b> (brand/GT-MT tidak diketahui, belum dihitung): {unknown.slice(0, 4).map((u) => u.n || u.k).join(', ')}{unknown.length > 4 ? ', …' : ''}.</div>}
          {unpriced.length > 0 && <div><b>{unpriced.length} barang belum punya harga NFI</b>: {unpriced.slice(0, 4).map((u) => u.n || u.k).join(', ')}{unpriced.length > 4 ? ', …' : ''}.</div>}
          <div className="small">Lengkapi di <b>Data &amp; Pengaturan → {cfg.nama} → Master barang</b>.</div>
        </div>
      )}

      <div className="subnav card">
        <nav className="tabs-inline" role="tablist">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{label}</button>
          ))}
        </nav>
        <div className="filters">
          {hasSalesman && (
            <select value={filter.salesman ?? ''} onChange={(e) => setFilter({ ...filter, salesman: e.target.value || undefined })} aria-label="Filter salesman">
              <option value="">Semua salesman</option>
              {options.salesman.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
          <select value={filter.brand ?? ''} onChange={(e) => setFilter({ ...filter, brand: e.target.value || undefined })} aria-label="Filter brand">
            <option value="">Semua brand</option>
            {options.brand.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <div className="seg" role="group" aria-label="Filter channel">
            {[undefined, ...CHANNELS].map((c) => (
              <button key={c ?? 'all'} className={filter.ch === c ? 'on' : ''} onClick={() => setFilter({ ...filter, ch: c as Ch | undefined })}>
                {c ?? 'Semua'}
              </button>
            ))}
          </div>
          {filtered && <button className="btn ghost" onClick={() => setFilter({})}>✕ Hapus filter</button>}
        </div>
      </div>

      {tab === 'ikhtisar' && <Ikhtisar s={s} rows={rows} month={month} color={color} filter={filter} go={go} hasSalesman={hasSalesman} hasTarget={hasTarget} />}
      {tab === 'toko' && <TokoTab rows={rows} month={month} go={go} hasSalesman={hasSalesman} hasArea={hasArea} />}
      {tab === 'produk' && <ProdukTab rows={rows} month={month} go={go} />}
      {tab === 'salesman' && <PeopleTab rows={rows} month={month} go={go} kind="salesman" />}
      {tab === 'area' && <PeopleTab rows={rows} month={month} go={go} kind="area" />}
      {tab === 'transaksi' && <TransaksiTab rows={rows} month={month} go={go} />}
    </div>
  )
}

// ---------------- Ikhtisar ----------------

function Ikhtisar({ s, rows, month, color, filter, go, hasSalesman, hasTarget }: {
  s: ReturnType<typeof summarize>; rows: Row[]; month: string; color: string; filter: Filter; go: Go; hasSalesman: boolean; hasTarget: boolean
}) {
  const trend = useMemo(() => monthlyTotals(rows).slice(-12), [rows])
  const top = useMemo(() => groupLines(rows, month, (r) => r.c, (r) => r.cn).slice(0, 10), [rows, month])
  const topProduk = useMemo(() => groupLines(rows, month, (r) => r.k, (r) => r.n).slice(0, 10), [rows, month])
  const lost = useMemo(() => lapsed(rows, month), [rows, month])
  return (
    <>
      <div className="grid-2">
        <div className="card">
          <div className="section-title"><h2>Omset kumulatif vs target</h2><span className="muted small">klik untuk detail hari</span></div>
          <Legend items={[{ label: 'Omset kumulatif', color, kind: 'line' }, ...(hasTarget ? [{ label: 'Laju target (per HK)', color: 'var(--target)', kind: 'dash' as const }] : [])]} />
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={s.daily} margin={{ left: 0, right: 16, top: 8 }} onClick={(e) => e?.activeLabel && go('hari', String(e.activeLabel))}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="d" tickFormatter={(d) => String(+d.slice(8))} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} minTickGap={8} />
              <YAxis tickFormatter={rpShort} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={56} />
              <Tooltip content={<ChartTip fmt={rp} labelFmt={dateLabel} />} />
              {hasTarget && <Line dataKey="targetCum" name="Laju target" stroke="var(--target)" strokeDasharray="4 3" strokeWidth={2} dot={false} />}
              <Line dataKey="cum" name="Omset kumulatif" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 6, stroke: 'var(--surface)', strokeWidth: 2, style: { cursor: 'pointer' } }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="section-title"><h2>Omset harian</h2><span className="muted small">klik batang untuk detail</span></div>
          <ResponsiveContainer width="100%" height={262}>
            <BarChart data={s.daily} margin={{ left: 0, right: 16, top: 8 }} onClick={(e) => e?.activeLabel && go('hari', String(e.activeLabel))}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="d" tickFormatter={(d) => String(+d.slice(8))} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} minTickGap={8} />
              <YAxis tickFormatter={rpShort} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={56} />
              <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip fmt={rp} labelFmt={dateLabel} />} />
              <Bar dataKey="omset" name="Omset" fill={color} radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="section-title"><h2>Distribusi</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Deskripsi</th><th className="n">Target</th><th className="n">Ach</th><th className="n">GAP</th><th className="n">%Ach</th></tr>
            </thead>
            <tbody>
              <DistRow label="Rata-rata EC / HK" t={s.tEcHk} a={s.ecHk} />
              <DistRow label="Assortment / EA GT" t={s.tAsrt} a={s.asrtGT} />
              {s.asrtByBrandGT.map((b) => (
                <DistRow key={b.brand} label={`Assortment / EA ${b.brand} GT`} t={b.t} a={b.v} onClick={() => go('brand', b.brand)} />
              ))}
              <DistRow label="EA GT" t={s.tEa.GT} a={s.ea.GT} int />
              <DistRow label="EA MT" t={s.tEa.MT} a={s.ea.MT} int />
            </tbody>
          </table>
        </div>
      </div>

      {CHANNELS.filter((ch) => !filter.ch || filter.ch === ch).map((ch) => (
        <BrandTable key={ch} title={CHANNEL_LABEL[ch]} lines={s.brands[ch]} tOmset={s.target[ch]} tEa={s.tEa[ch]} omset={s.omset[ch]} ea={s.ea[ch]}
          onPick={(b) => go('brand', b)} />
      ))}

      <div className="grid-2">
        <div className="card">
          <div className="section-title"><h2>Top 10 toko</h2></div>
          <DataTable rows={top} rowKey={(l) => l.key} limit={10} onRowClick={(l) => go('toko', l.key, l.name)} columns={lineCols('Toko', { sku: true })} />
        </div>
        <div className="card">
          <div className="section-title"><h2>Top 10 produk</h2></div>
          <DataTable rows={topProduk} rowKey={(l) => l.key} limit={10} onRowClick={(l) => go('produk', l.key, l.name)} columns={lineCols('Produk', { toko: true })} />
        </div>
      </div>

      <div className="grid-2">
        {hasSalesman && (
          <div className="card">
            <div className="section-title"><h2>Per salesman</h2></div>
            <DataTable rows={s.salesmen} rowKey={(x) => x.name} limit={20} onRowClick={(x) => go('salesman', x.name)}
              columns={[
                { key: 'name', label: 'Salesman', wide: true, render: (x) => <span className="link">{x.name}</span>, sort: (x) => x.name },
                { key: 'total', label: 'Omset', num: true, render: (x) => rp(x.total), sort: (x) => x.total },
                { key: 'share', label: 'Kontribusi', num: true, render: (x) => pct(ratio(x.total, s.omset.total)), sort: (x) => x.total },
                { key: 'ea', label: 'EA', num: true, render: (x) => num(x.ea), sort: (x) => x.ea },
                { key: 'ec', label: 'EC/HK', num: true, render: (x) => dec(x.ecHk), sort: (x) => x.ecHk },
              ]} />
          </div>
        )}
        <div className="card">
          <div className="section-title"><h2>Tren bulanan GT vs MT</h2></div>
          <Legend items={CHANNELS.map((c) => ({ label: CHANNEL_LABEL[c], color: CH_COLOR[c] }))} />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trend} margin={{ left: 0, right: 16, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m)} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <YAxis tickFormatter={rpShort} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={56} />
              <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip fmt={rp} labelFmt={(m) => monthLabel(m, true)} />} />
              <Bar dataKey="GT" name="GT" stackId="a" fill={CH_COLOR.GT} stroke="var(--surface)" strokeWidth={2} />
              <Bar dataKey="MT" name="MT" stackId="a" fill={CH_COLOR.MT} stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {lost.length > 0 && (
        <div className="card">
          <div className="section-title">
            <h2>Toko langganan yang belum order bulan ini</h2>
            <span className="muted small">{num(lost.length)} toko · omset 3 bln {rpShort(lost.reduce((a, l) => a + l.omset3, 0))}</span>
          </div>
          <DataTable rows={lost} rowKey={(l) => l.key} limit={10} onRowClick={(l) => go('toko', l.key, l.name)}
            columns={[
              { key: 'name', label: 'Toko', wide: true, render: (l) => <span className="link">{l.name}</span>, sort: (l) => l.name },
              { key: 'ar', label: 'Area', hideSm: true, render: (l) => l.area ?? '', sort: (l) => l.area ?? '' },
              { key: 's', label: 'Salesman', hideSm: true, render: (l) => l.s, sort: (l) => l.s },
              { key: 'o', label: 'Omset 3 bln', num: true, render: (l) => rpShort(l.omset3), sort: (l) => l.omset3 },
              { key: 'last', label: 'Terakhir', num: true, render: (l) => dateLabel(l.last), sort: (l) => l.last },
            ]} />
        </div>
      )}
    </>
  )
}

// ---------------- Toko ----------------

const STATUS_CLS: Record<TokoStatus, string> = { baru: 'new', naik: 'good', stabil: '', turun: 'warning', berhenti: 'critical' }

function TokoTab({ rows, month, go, hasSalesman, hasArea }: { rows: Row[]; month: string; go: Go; hasSalesman: boolean; hasArea: boolean }) {
  const [status, setStatus] = useState<TokoStatus | 'semua'>('semua')
  const lines = useMemo(() => {
    const first = firstSeen(rows, (r) => r.c)
    return groupLines(rows, month, (r) => r.c, (r) => r.cn, (r) => ({ area: r.ar ?? '', s: r.s }))
      .map((l) => ({ ...l, status: tokoStatus(l, first.get(l.key) ?? null, month) }))
  }, [rows, month])
  type L = (typeof lines)[number]
  const counts = useMemo(() => {
    const c: Record<string, number> = { semua: lines.length }
    for (const l of lines) c[l.status] = (c[l.status] ?? 0) + 1
    return c
  }, [lines])
  const shown = status === 'semua' ? lines : lines.filter((l) => l.status === status)
  const atRisk = lines.filter((l) => l.status === 'berhenti').reduce((a, l) => a + l.prev, 0)
  const cols: Column<L>[] = [
    { key: 'name', label: 'Toko', wide: true, render: (l) => <span className="link">{l.name}</span>, sort: (l) => l.name },
    ...(hasArea ? [{ key: 'area', label: 'Area', hideSm: true, render: (l: L) => l.extra.area, sort: (l: L) => l.extra.area }] : []),
    ...(hasSalesman ? [{ key: 's', label: 'Salesman', hideSm: true, render: (l: L) => l.extra.s, sort: (l: L) => l.extra.s }] : []),
    { key: 'omset', label: 'Omset', num: true, render: (l) => rp(l.omset), sort: (l) => l.omset },
    { key: 'prev', label: 'Bln lalu', num: true, hideSm: true, render: (l) => rpShort(l.prev), sort: (l) => l.prev },
    { key: 'g', label: 'Tren', num: true, render: (l) => <Delta g={l.growth} small />, sort: (l) => l.growth ?? 9 },
    { key: 'f', label: 'Faktur', num: true, hideSm: true, render: (l) => num(l.faktur), sort: (l) => l.faktur },
    { key: 'sku', label: 'SKU', num: true, render: (l) => num(l.sku), sort: (l) => l.sku },
    { key: 'last', label: 'Terakhir', num: true, hideSm: true, render: (l) => (l.last ? dateLabel(l.last) : '–'), sort: (l) => l.last ?? '' },
    { key: 'st', label: 'Status', render: (l) => <span className={`pill ${STATUS_CLS[l.status]}`}>{TOKO_STATUS_LABEL[l.status]}</span>, sort: (l) => l.status },
  ]

  return (
    <div className="card">
      <div className="section-title">
        <h2>Semua toko · {monthLabel(month, true)}</h2>
        <span className="muted small">dibanding {monthLabel(shiftMonth(month, -1))} · klik toko untuk detail</span>
      </div>
      <div className="chips">
        {(['semua', 'baru', 'naik', 'stabil', 'turun', 'berhenti'] as const).map((k) => (
          <button key={k} className={`chip-btn ${k !== 'semua' ? STATUS_CLS[k] : ''}${status === k ? ' on' : ''}`} onClick={() => setStatus(k)}>
            {k === 'semua' ? 'Semua' : TOKO_STATUS_LABEL[k]} <b>{num(counts[k] ?? 0)}</b>
          </button>
        ))}
        {atRisk > 0 && <span className="muted small">Omset bulan lalu dari toko yang belum order: <b>{rpShort(atRisk)}</b></span>}
      </div>
      <DataTable rows={shown} rowKey={(l) => l.key} limit={30} onRowClick={(l) => go('toko', l.key, l.name)}
        search={(l) => `${l.name} ${l.key} ${l.extra.area} ${l.extra.s}`} searchPlaceholder="Cari nama / kode toko / area…"
        initialSort={{ key: 'omset', dir: -1 }} columns={cols} />
    </div>
  )
}

// ---------------- Produk ----------------

function ProdukTab({ rows, month, go }: { rows: Row[]; month: string; go: Go }) {
  const lines = useMemo(() => groupLines(rows, month, (r) => r.k, (r) => r.n, (r) => ({ b: r.b, ch: r.ch })), [rows, month])
  const brands = useMemo(() => groupLines(rows, month, (r) => r.b, (r) => r.b), [rows, month])
  return (
    <>
      <div className="card">
        <div className="section-title"><h2>Brand</h2><span className="muted small">klik untuk detail brand</span></div>
        <div className="brand-cards">
          {brands.filter((b) => b.omset || b.prev).map((b) => (
            <button key={b.key} className="brand-card" onClick={() => go('brand', b.key)}>
              <span className="label">{b.name}</span>
              <span className="value">{rpShort(b.omset)}</span>
              <span className="sub"><Delta g={b.growth} small /> · {num(b.toko)} toko · {pct(b.share)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="section-title"><h2>Semua produk · {monthLabel(month, true)}</h2></div>
        <DataTable rows={lines} rowKey={(l) => l.key} limit={30} onRowClick={(l) => go('produk', l.key, l.name)}
          search={(l) => `${l.name} ${l.key} ${l.extra.b}`} searchPlaceholder="Cari produk / kode / brand…"
          columns={[
            { key: 'name', label: 'Produk', wide: true, render: (l) => <span className="link">{l.name}</span>, sort: (l) => l.name },
            { key: 'b', label: 'Brand', hideSm: true, render: (l) => l.extra.b, sort: (l) => l.extra.b },
            { key: 'ch', label: 'Ch', hideSm: true, render: (l) => l.extra.ch, sort: (l) => l.extra.ch },
            { key: 'omset', label: 'Omset', num: true, render: (l) => rp(l.omset), sort: (l) => l.omset },
            { key: 'g', label: 'Tren', num: true, render: (l) => <Delta g={l.growth} small />, sort: (l) => l.growth ?? 9 },
            { key: 'qty', label: 'Qty', num: true, hideSm: true, render: (l) => num(l.qty), sort: (l) => l.qty },
            { key: 'toko', label: 'Toko', num: true, render: (l) => num(l.toko), sort: (l) => l.toko },
            { key: 'share', label: 'Kontribusi', num: true, hideSm: true, render: (l) => pct(l.share), sort: (l) => l.share },
          ]} />
      </div>
    </>
  )
}

// ---------------- Salesman / Area ----------------

const areaKey = (r: Row) => r.ar || '(tanpa area)'
const salesKey = (r: Row) => r.s

function PeopleTab({ rows, month, go, kind }: { rows: Row[]; month: string; go: Go; kind: 'salesman' | 'area' }) {
  const lines = useMemo(() => {
    const key = kind === 'salesman' ? salesKey : areaKey
    const days = new Map<string, Set<string>>()
    const fak = new Map<string, Set<string>>()
    const gt = new Map<string, number>()
    for (const r of inMonth(rows, month)) {
      const k = key(r)
      if (!days.has(k)) {
        days.set(k, new Set())
        fak.set(k, new Set())
      }
      days.get(k)!.add(r.d)
      fak.get(k)!.add(`${r.d}|${r.f || r.c}`)
      if (r.ch === 'GT') gt.set(k, (gt.get(k) ?? 0) + r.v)
    }
    return groupLines(rows, month, key, key).map((l) => ({
      ...l,
      ec: days.get(l.key)?.size ? fak.get(l.key)!.size / days.get(l.key)!.size : 0,
      gtShare: l.omset ? (gt.get(l.key) ?? 0) / l.omset : 0,
    }))
  }, [rows, month, kind])
  type L = (typeof lines)[number]
  const cols: Column<L>[] = [
    { key: 'name', label: kind === 'salesman' ? 'Salesman' : 'Area', wide: true, render: (l) => <span className="link">{l.name}</span>, sort: (l) => l.name },
    { key: 'omset', label: 'Omset', num: true, render: (l) => rp(l.omset), sort: (l) => l.omset },
    { key: 'g', label: 'Tren', num: true, render: (l) => <Delta g={l.growth} small />, sort: (l) => l.growth ?? 9 },
    { key: 'share', label: 'Kontribusi', num: true, hideSm: true, render: (l) => pct(l.share), sort: (l) => l.share },
    { key: 'toko', label: 'EA', num: true, render: (l) => num(l.toko), sort: (l) => l.toko },
    { key: 'ec', label: 'EC/hari', num: true, hideSm: true, render: (l) => dec(l.ec), sort: (l) => l.ec },
    { key: 'gt', label: '% GT', num: true, hideSm: true, render: (l) => pct(l.gtShare), sort: (l) => l.gtShare },
  ]
  return (
    <div className="card">
      <div className="section-title"><h2>{kind === 'salesman' ? 'Salesman' : 'Area / pasar'} · {monthLabel(month, true)}</h2><span className="muted small">klik untuk detail</span></div>
      <DataTable rows={lines} rowKey={(l) => l.key} limit={50} onRowClick={(l) => go(kind, l.key)} search={(l) => l.name} columns={cols} />
    </div>
  )
}

// ---------------- Transaksi ----------------

function TransaksiTab({ rows, month, go }: { rows: Row[]; month: string; go: Go }) {
  const list = useMemo(() => invoices(inMonth(rows, month)), [rows, month])
  type I = (typeof list)[number]
  const cols: Column<I>[] = [
    { key: 'd', label: 'Tanggal', render: (i) => <button className="link" onClick={(e) => { e.stopPropagation(); go('hari', i.d) }}>{dateLabel(i.d)}</button>, sort: (i) => i.d },
    { key: 'f', label: 'No. faktur', render: (i) => <span className="link">{i.f}</span>, sort: (i) => i.f },
    { key: 'c', label: 'Toko', wide: true, render: (i) => <button className="link" onClick={(e) => { e.stopPropagation(); go('toko', i.c, i.cn) }}>{i.cn}</button>, sort: (i) => i.cn },
    { key: 's', label: 'Salesman', hideSm: true, render: (i) => i.s, sort: (i) => i.s },
    { key: 'n', label: 'Item', num: true, hideSm: true, render: (i) => num(i.lines.length), sort: (i) => i.lines.length },
    { key: 't', label: 'Total', num: true, render: (i) => rp(i.total), sort: (i) => i.total },
  ]
  return (
    <div className="card">
      <div className="section-title"><h2>Faktur · {monthLabel(month, true)}</h2><span className="muted small">{num(list.length)} faktur · klik untuk isi faktur</span></div>
      <DataTable rows={list} rowKey={(i) => i.id} limit={30} onRowClick={(i) => go('faktur', i.id, i.f)}
        search={(i) => `${i.f} ${i.cn} ${i.s}`} searchPlaceholder="Cari no. faktur / toko / salesman…" columns={cols} />
    </div>
  )
}

// ---------------- potongan tabel ----------------

const lineCols = (label: string, o: { sku?: boolean; toko?: boolean } = {}): Column<GroupLine>[] => [
  { key: 'name', label, wide: true, render: (l) => <span className="link">{l.name}</span>, sort: (l) => l.name },
  { key: 'omset', label: 'Omset', num: true, render: (l) => rp(l.omset), sort: (l) => l.omset },
  { key: 'g', label: 'Tren', num: true, render: (l) => <Delta g={l.growth} small />, sort: (l) => l.growth ?? 9 },
  ...(o.sku ? [{ key: 'sku', label: 'SKU', num: true, render: (l: GroupLine) => num(l.sku), sort: (l: GroupLine) => l.sku }] : []),
  ...(o.toko ? [{ key: 'toko', label: 'Toko', num: true, render: (l: GroupLine) => num(l.toko), sort: (l: GroupLine) => l.toko }] : []),
]

const pctClass = (r: number) => (r >= 1 ? 'good' : r >= 0.8 ? 'warning' : 'critical')

function DistRow({ label, t, a, int, onClick }: { label: string; t: number; a: number; int?: boolean; onClick?: () => void }) {
  const f = int ? num : dec
  const r = t ? a / t : null
  return (
    <tr className={onClick ? 'clickable' : undefined} onClick={onClick}>
      <td>{onClick ? <span className="link">{label}</span> : label}</td>
      <td className="n">{t ? f(t) : '–'}</td>
      <td className="n">{f(a)}</td>
      <td className="n">{t ? f(a - t) : '–'}</td>
      <td className="n">{r == null ? '–' : <span className={`pct ${pctClass(r)}`}>{pct(r)}</span>}</td>
    </tr>
  )
}

function BrandTable({ title, lines, tOmset, tEa, omset, ea, onPick }: {
  title: string; lines: BrandLine[]; tOmset: number; tEa: number; omset: number; ea: number; onPick: (b: string) => void
}) {
  if (!lines.length && !tOmset) return null
  return (
    <div className="card">
      <div className="section-title"><h2>{title}</h2><span className="muted small">klik brand untuk detail</span></div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th rowSpan={2}>Brand</th>
              <th className="n group" colSpan={4}>Volume (omset)</th>
              <th className="n group" colSpan={4}>Distribusi (EA)</th>
            </tr>
            <tr>
              <th className="n">Target</th><th className="n">Ach</th><th className="n">GAP</th><th className="n">%Ach</th>
              <th className="n">Target</th><th className="n">Ach</th><th className="n">GAP</th><th className="n">%Ach</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <Line4 key={l.brand} name={l.brand} t={l.tOmset} a={l.omset} te={l.tEa} ae={l.ea} onClick={() => onPick(l.brand)} />
            ))}
            <Line4 total name={`TOTAL ${title.split(' ')[0].toUpperCase()}`} t={tOmset} a={omset} te={tEa} ae={ea} />
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PctCell({ a, t }: { a: number; t: number }) {
  const r = ratio(a, t)
  return <td className="n">{r == null ? '–' : <span className={`pct ${pctClass(r)}`}>{pct(r)}</span>}</td>
}

function Line4({ name, t, a, te, ae, total, onClick }: {
  name: string; t: number; a: number; te: number; ae: number; total?: boolean; onClick?: () => void
}) {
  return (
    <tr className={total ? 'total' : 'clickable'} onClick={onClick}>
      <td>{total ? name : <span className="link">{name}</span>}</td>
      <td className="n">{t ? rp(t) : '–'}</td>
      <td className="n">{rp(a)}</td>
      <td className="n">{t ? rp(a - t) : '–'}</td>
      <PctCell a={a} t={t} />
      <td className="n">{te ? num(te) : '–'}</td>
      <td className="n">{num(ae)}</td>
      <td className="n">{te ? num(ae - te) : '–'}</td>
      <PctCell a={ae} t={te} />
    </tr>
  )
}
