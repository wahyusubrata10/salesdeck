import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Prepared } from '../App'
import { growth, monthly } from '../lib/analysis'
import { SERIES } from '../lib/colors'
import { dateLabel, monthLabel, shiftMonth, timeGone } from '../lib/dates'
import { dec, num, pct, rp, rpShort } from '../lib/format'
import { CHANNELS, monthlyTotals, summarize } from '../lib/metrics'
import { isTargetFilled, type DistributorConfig, type Targets } from '../lib/types'
import { useDetail } from './detail/context'
import { Delta } from './detail/DetailViews'
import { AchBar, ChartTip, Legend, StatusBadge } from './ui'

interface Props {
  configs: DistributorConfig[]
  prepared: Prepared
  targets: Targets
  month: string
  onOpen: (id: string) => void
  onFillTarget: (month: string, id?: string) => void
}

const lastDateOf = (rows: { d: string }[]) => rows.reduce((m, r) => (r.d > m ? r.d : m), '0000-00-00')

export default function Overview({ configs, prepared, targets, month, onOpen, onFillTarget }: Props) {
  const { open } = useDetail()
  const prevMonth = shiftMonth(month, -1)
  const list = useMemo(
    () =>
      configs.map((cfg, i) => {
        const rows = prepared[cfg.id]?.rows ?? []
        return {
          cfg,
          color: SERIES[i],
          hasData: rows.length > 0,
          s: summarize(rows, month, targets[cfg.id]?.[month]),
          p: summarize(rows, prevMonth),
          spark: monthly(rows, month, 6),
        }
      }),
    [configs, prepared, targets, month, prevMonth],
  )

  const tg = timeGone(month)
  const omset = list.reduce((a, x) => a + x.s.omset.total, 0)
  const omsetPrev = list.reduce((a, x) => a + x.p.omset.total, 0)
  const target = list.reduce((a, x) => a + x.s.target.total, 0)
  const est = list.reduce((a, x) => a + x.s.estClosing, 0)
  const ea = list.reduce((a, x) => a + x.s.ea.total, 0)
  const eaPrev = list.reduce((a, x) => a + x.p.ea.total, 0)
  const ach = target > 0 ? omset / target : null

  const trend = useMemo(() => {
    const byMonth = new Map<string, Record<string, number | string>>()
    configs.forEach((cfg) => {
      for (const t of monthlyTotals(prepared[cfg.id]?.rows ?? [])) {
        const row = byMonth.get(t.month) ?? { month: t.month }
        row[cfg.id] = t.total
        byMonth.set(t.month, row)
      }
    })
    return [...byMonth.values()].sort((a, b) => String(a.month).localeCompare(String(b.month))).slice(-12)
  }, [configs, prepared])

  // Matriks brand × distributor (omset bulan ini) per channel.
  const matrix = useMemo(() => {
    const out = {} as Record<(typeof CHANNELS)[number], { brand: string; by: Record<string, number>; total: number }[]>
    for (const ch of CHANNELS) {
      const m = new Map<string, { brand: string; by: Record<string, number>; total: number }>()
      for (const x of list)
        for (const b of x.s.brands[ch]) {
          if (!b.omset) continue
          const row = m.get(b.brand) ?? { brand: b.brand, by: {}, total: 0 }
          row.by[x.cfg.id] = b.omset
          row.total += b.omset
          m.set(b.brand, row)
        }
      out[ch] = [...m.values()].sort((a, b) => b.total - a.total)
    }
    return out
  }, [list])

  const achData = list.filter((x) => x.s.ach != null).map((x) => ({ name: x.cfg.nama, id: x.cfg.id, ach: x.s.ach, color: x.color }))

  if (list.every((x) => !x.hasData)) {
    return (
      <div className="card empty">
        <h2>Belum ada data</h2>
        <p>Upload file data penjualan dari email di kotak di atas.</p>
      </div>
    )
  }

  const withData = list.filter((x) => x.hasData)
  const missingTarget = withData.filter((x) => !isTargetFilled(targets[x.cfg.id]?.[month]))

  return (
    <div className="stack">
      {missingTarget.length > 0 && (
        <div className="notice warn row" style={{ justifyContent: 'space-between' }}>
          <span>
            Target <b>{monthLabel(month, true)}</b> belum diisi untuk {missingTarget.map((x) => x.cfg.nama).join(', ')}.
          </span>
          <button className="btn primary" onClick={() => onFillTarget(month, missingTarget[0].cfg.id)}>Isi target</button>
        </div>
      )}

      <div className="card hero-card">
        <div className="section-title">
          <h1>Ringkasan <span className="h-sub">{monthLabel(month, true)}</span></h1>
          <span className="muted small">Time gone {pct(tg.ratio)} · HK {tg.elapsed}/{tg.total}</span>
        </div>
        <div className="kpis">
          <div className="kpi accent">
            <div className="label">Total omset {withData.length} distributor</div>
            <div className="hero">{rpShort(omset)}</div>
            <div className="sub"><Delta g={growth(omset, omsetPrev)} small /> vs {monthLabel(prevMonth)}</div>
          </div>
          <div className="kpi">
            <div className="label">Pencapaian target</div>
            <div className="value">{pct(ach)}</div>
            <div className="sub">{target ? <>dari {rpShort(target)} · <StatusBadge gap={ach == null ? null : ach - tg.ratio} /></> : 'target belum diisi'}</div>
            {target > 0 && <AchBar ach={ach} tg={tg.ratio} />}
          </div>
          <div className="kpi">
            <div className="label">Estimasi closing</div>
            <div className="value">{rpShort(est)}</div>
            <div className="sub">{target ? `${pct(est / target)} dari target` : ''}</div>
          </div>
          <div className="kpi">
            <div className="label">Toko aktif (EA)</div>
            <div className="value">{num(ea)}</div>
            <div className="sub"><Delta g={growth(ea, eaPrev)} small /> vs bln lalu</div>
          </div>
        </div>
      </div>

      <div className="dist-cards">
        {list.map((x) => (
          <button key={x.cfg.id} className="dist-card card" onClick={() => onOpen(x.cfg.id)} disabled={!x.hasData}>
            <div className="dc-head">
              <span className="row" style={{ gap: 8 }}><span className="swatch lg" style={{ background: x.color }} /><b>{x.cfg.nama}</b></span>
              {x.hasData && <StatusBadge gap={x.s.gapTg} />}
            </div>
            {x.hasData && !x.s.rowCount ? (
              <div className="muted small" style={{ padding: '12px 0' }}>
                Belum ada data {monthLabel(month, true)}. Data terakhir: {dateLabel(lastDateOf(prepared[x.cfg.id]?.rows ?? []))}.
              </div>
            ) : x.hasData ? (
              <>
                <div className="dc-main">
                  <div>
                    <div className="dc-omset">{rpShort(x.s.omset.total)}</div>
                    <div className="small text-2"><Delta g={growth(x.s.omset.total, x.p.omset.total)} small /> vs bln lalu</div>
                  </div>
                  <div className="dc-spark" aria-hidden>
                    <ResponsiveContainer width="100%" height={44}>
                      <BarChart data={x.spark} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
                        <Bar dataKey="omset" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                          {x.spark.map((d) => <Cell key={d.month} fill={x.color} fillOpacity={d.month === month ? 1 : 0.35} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="dc-ach">
                  <span>{x.s.target.total ? `${pct(x.s.ach)} dari ${rpShort(x.s.target.total)}` : 'Target belum diisi'}</span>
                  <span className="muted">TG {pct(x.s.tg.ratio)}</span>
                </div>
                <AchBar ach={x.s.ach} tg={x.s.tg.ratio} />
                <div className="dc-foot">
                  <span>EA <b>{num(x.s.ea.total)}</b></span>
                  <span>EC/HK <b>{dec(x.s.ecHk)}</b></span>
                  <span>Est. <b>{rpShort(x.s.estClosing)}</b></span>
                  <span className="muted">{x.s.lastDate ? `s/d ${dateLabel(x.s.lastDate)}` : 'tidak ada transaksi'}</span>
                </div>
              </>
            ) : (
              <div className="muted small" style={{ padding: '12px 0' }}>Belum ada data — upload file datanya di atas.</div>
            )}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title"><h2>% Pencapaian vs Time Gone</h2><span className="muted small">klik batang untuk detail</span></div>
          <Legend items={[{ label: `Time Gone ${pct(tg.ratio)}`, color: 'var(--target)', kind: 'dash' }]} />
          {achData.length ? (
            <ResponsiveContainer width="100%" height={60 + achData.length * 44}>
              <BarChart data={achData} layout="vertical" margin={{ left: 8, right: 48 }} onClick={(e) => {
                const id = achData.find((a) => a.name === e?.activeLabel)?.id
                if (id) onOpen(id)
              }}>
                <CartesianGrid horizontal={false} stroke="var(--grid)" />
                <XAxis type="number" domain={[0, (max: number) => Math.max(1.1, max)]} tickFormatter={(v) => pct(v)} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={100} stroke="var(--axis)" tick={{ fill: 'var(--text-2)', fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip fmt={(v) => pct(v)} />} />
                <ReferenceLine x={tg.ratio} stroke="var(--target)" strokeDasharray="4 3" strokeWidth={2} />
                <Bar dataKey="ach" name="% Ach" radius={[0, 4, 4, 0]} barSize={18} style={{ cursor: 'pointer' }}
                  label={{ position: 'right', formatter: (v: unknown) => pct(Number(v)), fill: 'var(--text-2)', fontSize: 12 }}>
                  {achData.map((d) => <Cell key={d.id} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty small">
              Isi target untuk melihat pencapaian. <button className="btn" onClick={() => onFillTarget(month)}>Isi target</button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title"><h2>Tren omset bulanan</h2></div>
          <Legend items={configs.map((c, i) => ({ label: c.nama, color: SERIES[i], kind: 'line' as const }))} />
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend} margin={{ left: 0, right: 16, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m)} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <YAxis tickFormatter={rpShort} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={56} />
              <Tooltip content={<ChartTip fmt={rp} labelFmt={(m) => monthLabel(m, true)} />} />
              {configs.map((c, i) => (
                <Line key={c.id} type="monotone" dataKey={c.id} name={c.nama} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="section-title"><h2>Omset per brand × distributor</h2><span className="muted small">klik angka untuk detail brand di distributor tsb</span></div>
        <div className="grid-2">
          {CHANNELS.map((ch) => (
            <div key={ch} className="table-wrap">
              <table className="matrix">
                <thead>
                  <tr>
                    <th>{ch === 'GT' ? 'Traditional (GT)' : 'Modern (MT)'}</th>
                    {withData.map((x) => (
                      <th key={x.cfg.id} className="n"><span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}><span className="swatch" style={{ background: x.color }} />{x.cfg.nama}</span></th>
                    ))}
                    <th className="n">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix[ch].map((r) => (
                    <tr key={r.brand}>
                      <td>{r.brand}</td>
                      {withData.map((x) => (
                        <td key={x.cfg.id} className="n">
                          {r.by[x.cfg.id] ? <button className="link" onClick={() => open({ kind: 'brand', dist: x.cfg.id, id: r.brand })}>{rpShort(r.by[x.cfg.id])}</button> : '–'}
                        </td>
                      ))}
                      <td className="n"><b>{rpShort(r.total)}</b></td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Total {ch}</td>
                    {withData.map((x) => <td key={x.cfg.id} className="n">{rpShort(x.s.omset[ch])}</td>)}
                    <td className="n">{rpShort(withData.reduce((a, x) => a + x.s.omset[ch], 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
