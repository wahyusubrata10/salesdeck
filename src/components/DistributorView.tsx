import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dateLabel, monthLabel } from '../lib/dates'
import { dec, num, pct, ratio, rp, rpShort } from '../lib/format'
import { CHANNEL_LABEL, CHANNELS, monthlyTotals, summarize, type BrandLine } from '../lib/metrics'
import type { DistributorConfig, MonthTarget, SaleRow } from '../lib/types'
import { AchBar, ChartTip, Kpi, Legend, StatusBadge } from './ui'
import { CH_COLOR } from '../lib/colors'

interface Props {
  cfg: DistributorConfig
  color: string
  rows: SaleRow[]
  target?: MonthTarget
  month: string
}

export default function DistributorView({ cfg, color, rows, target, month }: Props) {
  const s = useMemo(() => summarize(cfg, rows, month, target), [cfg, rows, month, target])
  const trend = useMemo(() => monthlyTotals(cfg, rows).slice(-12), [cfg, rows])

  if (!rows.length) {
    return (
      <div className="card empty">
        <h2>{cfg.nama}</h2>
        <p>Belum ada data. Upload file Excel di tab <b>Data &amp; Pengaturan</b>.</p>
      </div>
    )
  }

  const selisih = s.omset.total - s.target.total
  const hasTarget = s.target.total > 0

  return (
    <div className="stack">
      <div className="card">
        <div className="section-title">
          <h1 className="row" style={{ gap: 8 }}>
            <span className="swatch" style={{ background: color, width: 14, height: 14 }} />
            {cfg.nama} · {monthLabel(month, true)}
          </h1>
          <span className="muted small">
            {s.lastDate ? `Data s/d ${dateLabel(s.lastDate)}` : 'Tidak ada transaksi di bulan ini'} · {cfg.fileName ?? ''}
          </span>
        </div>
        <div className="kpis">
          <div className="kpi">
            <div className="label">Ach Omset</div>
            <div className="hero">{rpShort(s.omset.total)}</div>
            <div className="sub">{rp(s.omset.total)}</div>
          </div>
          <Kpi label="Target" value={hasTarget ? rpShort(s.target.total) : '–'} sub={hasTarget ? `Selisih ${rpShort(selisih)}` : 'Belum diisi'} />
          <Kpi label="% Ach" value={pct(s.ach)} sub={<AchBar ach={s.ach} tg={s.tg.ratio} />} />
          <Kpi label="Time Gone" value={pct(s.tg.ratio)} sub={`HK ${s.tg.elapsed}/${s.tg.total} · sisa ${s.tg.remaining}`} />
          <Kpi label="GAP vs TG" value={pct(s.gapTg)} sub={<StatusBadge gap={s.gapTg} />} />
          <Kpi label="Rata-rata omset / HK" value={rpShort(s.avgOmsetHk)} sub={`${s.sellingDays} hari transaksi`} />
          <Kpi label="Estimasi closing" value={rpShort(s.estClosing)} sub={hasTarget ? `${pct(s.estClosing / s.target.total)} dari target` : undefined} />
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
                <DistRow key={b.brand} label={`Assortment / EA ${b.brand} GT`} t={0} a={b.v} />
              ))}
              <DistRow label="EA GT" t={s.tEa.GT} a={s.ea.GT} int />
              <DistRow label="EA MT" t={s.tEa.MT} a={s.ea.MT} int />
            </tbody>
          </table>
        </div>
      </div>

      {CHANNELS.map((ch) => (
        <BrandTable key={ch} title={CHANNEL_LABEL[ch]} lines={s.brands[ch]} tOmset={s.target[ch]} tEa={s.tEa[ch]} omset={s.omset[ch]} ea={s.ea[ch]} />
      ))}

      <div className="grid-2">
        <div className="card">
          <div className="section-title"><h2>Omset kumulatif vs target</h2></div>
          <Legend items={[{ label: 'Omset kumulatif', color, kind: 'line' }, ...(hasTarget ? [{ label: 'Laju target (per HK)', color: 'var(--target)', kind: 'dash' as const }] : [])]} />
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={s.daily} margin={{ left: 0, right: 16, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="d" tickFormatter={(d) => String(+d.slice(8))} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} minTickGap={8} />
              <YAxis tickFormatter={rpShort} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={60} />
              <Tooltip content={<ChartTip fmt={rp} labelFmt={dateLabel} />} />
              {hasTarget && <Line dataKey="targetCum" name="Laju target" stroke="var(--target)" strokeDasharray="4 3" strokeWidth={2} dot={false} />}
              <Line dataKey="cum" name="Omset kumulatif" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="section-title"><h2>Omset harian</h2></div>
          <ResponsiveContainer width="100%" height={262}>
            <BarChart data={s.daily} margin={{ left: 0, right: 16, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="d" tickFormatter={(d) => String(+d.slice(8))} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} minTickGap={8} />
              <YAxis tickFormatter={rpShort} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={60} />
              <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip fmt={rp} labelFmt={dateLabel} />} />
              <Bar dataKey="omset" name="Omset" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="section-title"><h2>Per salesman</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Salesman</th><th className="n">Omset GT</th><th className="n">Omset MT</th><th className="n">Total</th><th className="n">Kontribusi</th><th className="n">EA</th><th className="n">EC / HK</th></tr>
            </thead>
            <tbody>
              {s.salesmen.map((x) => (
                <tr key={x.name}>
                  <td>{x.name}</td>
                  <td className="n">{rp(x.GT)}</td>
                  <td className="n">{rp(x.MT)}</td>
                  <td className="n">{rp(x.total)}</td>
                  <td className="n">{pct(ratio(x.total, s.omset.total))}</td>
                  <td className="n">{num(x.ea)}</td>
                  <td className="n">{dec(x.ecHk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title"><h2>Top 10 toko</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Toko</th><th className="n">Omset</th><th className="n">SKU</th></tr></thead>
              <tbody>
                {s.topToko.map((t, i) => (
                  <tr key={t.c}><td className="muted">{i + 1}</td><td>{t.cn}</td><td className="n">{rp(t.omset)}</td><td className="n">{t.sku}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="section-title"><h2>Tren bulanan GT vs MT</h2></div>
          <Legend items={CHANNELS.map((c) => ({ label: CHANNEL_LABEL[c], color: CH_COLOR[c] }))} />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trend} margin={{ left: 0, right: 16, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m)} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <YAxis tickFormatter={rpShort} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={60} />
              <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip fmt={rp} labelFmt={(m) => monthLabel(m, true)} />} />
              <Bar dataKey="GT" name="GT" stackId="a" fill={CH_COLOR.GT} stroke="var(--surface)" strokeWidth={2} />
              <Bar dataKey="MT" name="MT" stackId="a" fill={CH_COLOR.MT} stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function DistRow({ label, t, a, int }: { label: string; t: number; a: number; int?: boolean }) {
  const f = int ? num : dec
  return (
    <tr>
      <td>{label}</td>
      <td className="n">{t ? f(t) : '–'}</td>
      <td className="n">{f(a)}</td>
      <td className="n">{t ? f(a - t) : '–'}</td>
      <td className="n">{t ? pct(a / t) : '–'}</td>
    </tr>
  )
}

function BrandTable({ title, lines, tOmset, tEa, omset, ea }: { title: string; lines: BrandLine[]; tOmset: number; tEa: number; omset: number; ea: number }) {
  if (!lines.length && !tOmset) return null
  return (
    <div className="card">
      <div className="section-title"><h2>{title}</h2></div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th rowSpan={2}>Brand</th>
              <th className="n" colSpan={4} style={{ textAlign: 'center' }}>Volume (omset)</th>
              <th className="n" colSpan={4} style={{ textAlign: 'center' }}>Distribusi (EA)</th>
            </tr>
            <tr>
              <th className="n">Target</th><th className="n">Ach</th><th className="n">GAP</th><th className="n">%Ach</th>
              <th className="n">Target</th><th className="n">Ach</th><th className="n">GAP</th><th className="n">%Ach</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <Line4 key={l.brand} name={l.brand} t={l.tOmset} a={l.omset} te={l.tEa} ae={l.ea} />
            ))}
            <Line4 total name={`TOTAL ${title.split(' ')[0].toUpperCase()}`} t={tOmset} a={omset} te={tEa} ae={ea} />
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Line4({ name, t, a, te, ae, total }: { name: string; t: number; a: number; te: number; ae: number; total?: boolean }) {
  return (
    <tr className={total ? 'total' : undefined}>
      <td>{name}</td>
      <td className="n">{t ? rp(t) : '–'}</td>
      <td className="n">{rp(a)}</td>
      <td className="n">{t ? rp(a - t) : '–'}</td>
      <td className="n">{pct(ratio(a, t))}</td>
      <td className="n">{te ? num(te) : '–'}</td>
      <td className="n">{num(ae)}</td>
      <td className="n">{te ? num(ae - te) : '–'}</td>
      <td className="n">{pct(ratio(ae, te))}</td>
    </tr>
  )
}
