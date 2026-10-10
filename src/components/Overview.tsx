import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Prepared } from '../App'
import { dateLabel, monthLabel, timeGone } from '../lib/dates'
import { dec, num, pct, rp, rpShort } from '../lib/format'
import { CHANNELS, monthlyTotals, summarize } from '../lib/metrics'
import { isTargetFilled, type DistributorConfig, type Targets } from '../lib/types'
import { AchBar, ChartTip, Kpi, Legend, StatusBadge } from './ui'
import { SERIES } from '../lib/colors'

interface Props {
  configs: DistributorConfig[]
  prepared: Prepared
  targets: Targets
  month: string
  onOpen: (id: string) => void
  onFillTarget: (month: string, id?: string) => void
}

export default function Overview({ configs, prepared, targets, month, onOpen, onFillTarget }: Props) {
  const list = useMemo(
    () =>
      configs.map((cfg, i) => ({
        cfg,
        color: SERIES[i],
        hasData: (prepared[cfg.id]?.rows.length ?? 0) > 0,
        s: summarize(prepared[cfg.id]?.rows ?? [], month, targets[cfg.id]?.[month]),
      })),
    [configs, prepared, targets, month],
  )

  const tg = timeGone(month)
  const omset = list.reduce((a, x) => a + x.s.omset.total, 0)
  const target = list.reduce((a, x) => a + x.s.target.total, 0)
  const est = list.reduce((a, x) => a + x.s.estClosing, 0)
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
        <p>Buka tab <b>Data &amp; Pengaturan</b> untuk upload file Excel tiap distributor.</p>
      </div>
    )
  }

  const missingTarget = list.filter((x) => x.hasData && !isTargetFilled(targets[x.cfg.id]?.[month]))

  return (
    <div className="stack">
      {missingTarget.length > 0 && (
        <div className="notice warn row" style={{ justifyContent: 'space-between' }}>
          <span>
            Target <b>{monthLabel(month, true)}</b> belum diisi untuk {missingTarget.map((x) => x.cfg.nama).join(', ')}.
          </span>
          <button className="btn primary" onClick={() => onFillTarget(month, missingTarget[0].cfg.id)}>Isi target sekarang</button>
        </div>
      )}
      <div className="card">
        <div className="section-title">
          <h1>Ringkasan {monthLabel(month, true)}</h1>
          <span className="muted small">Time Gone {pct(tg.ratio)} · HK {tg.elapsed}/{tg.total}</span>
        </div>
        <div className="kpis">
          <div className="kpi">
            <div className="label">Total omset 4 distributor</div>
            <div className="hero">{rpShort(omset)}</div>
            <div className="sub">{rp(omset)}</div>
          </div>
          <Kpi label="Total target" value={target ? rpShort(target) : '–'} sub={target ? rp(target) : 'Isi di tab Target'} />
          <Kpi label="% Pencapaian" value={pct(ach)} sub={<StatusBadge gap={ach == null ? null : ach - tg.ratio} />} />
          <Kpi label="Estimasi closing" value={rpShort(est)} sub={target ? `${pct(est / target)} dari target` : undefined} />
        </div>
      </div>

      <div className="card">
        <div className="section-title"><h2>Per distributor</h2><span className="muted small">Klik nama untuk detail</span></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Distributor</th>
                <th className="n">Omset</th>
                <th className="n">Target</th>
                <th className="n">%Ach</th>
                <th style={{ minWidth: 120 }}>vs Time Gone</th>
                <th className="n">GAP vs TG</th>
                <th>Status</th>
                <th className="n">Est. closing</th>
                <th className="n">EA</th>
                <th className="n">EC / HK</th>
                <th>Data s/d</th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ cfg, color, s, hasData }) => (
                <tr key={cfg.id}>
                  <td>
                    <button className="tab" style={{ padding: '2px 4px' }} onClick={() => onOpen(cfg.id)}>
                      <span className="swatch" style={{ background: color }} />
                      {cfg.nama}
                    </button>
                  </td>
                  {hasData ? (
                    <>
                      <td className="n">{rp(s.omset.total)}</td>
                      <td className="n">{s.target.total ? rp(s.target.total) : '–'}</td>
                      <td className="n">{pct(s.ach)}</td>
                      <td><AchBar ach={s.ach} tg={s.tg.ratio} /></td>
                      <td className="n">{pct(s.gapTg)}</td>
                      <td><StatusBadge gap={s.gapTg} /></td>
                      <td className="n">{rp(s.estClosing)}</td>
                      <td className="n">{num(s.ea.total)}</td>
                      <td className="n">{dec(s.ecHk)}</td>
                      <td className="small text-2">{s.lastDate ? dateLabel(s.lastDate) : 'tidak ada transaksi'}</td>
                    </>
                  ) : (
                    <td colSpan={10} className="muted">Belum upload data</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title"><h2>% Pencapaian vs Time Gone</h2></div>
          <Legend items={[{ label: `Time Gone ${pct(tg.ratio)}`, color: 'var(--target)', kind: 'dash' }]} />
          {achData.length ? (
            <ResponsiveContainer width="100%" height={60 + achData.length * 44}>
              <BarChart data={achData} layout="vertical" margin={{ left: 8, right: 48 }}>
                <CartesianGrid horizontal={false} stroke="var(--grid)" />
                <XAxis type="number" domain={[0, (max: number) => Math.max(1.1, max)]} tickFormatter={(v) => pct(v)} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} stroke="var(--axis)" tick={{ fill: 'var(--text-2)', fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip fmt={(v) => pct(v)} />} />
                <ReferenceLine x={tg.ratio} stroke="var(--target)" strokeDasharray="4 3" strokeWidth={2} />
                <Bar dataKey="ach" name="% Ach" radius={[0, 4, 4, 0]} barSize={18} label={{ position: 'right', formatter: (v: unknown) => pct(Number(v)), fill: 'var(--text-2)', fontSize: 12 }}
                  shape={(p: { x?: number; y?: number; width?: number; height?: number; payload?: { color: string } }) => (
                    <rect x={p.x} y={p.y} width={Math.max(0, p.width ?? 0)} height={p.height} rx={4} fill={p.payload?.color} />
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty small">
              Isi target untuk melihat pencapaian.{' '}
              <button className="btn" onClick={() => onFillTarget(month)}>Isi target</button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title"><h2>Tren omset bulanan</h2></div>
          <Legend items={configs.map((c, i) => ({ label: c.nama, color: SERIES[i], kind: 'line' as const }))} />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend} margin={{ left: 0, right: 16, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m)} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <YAxis tickFormatter={rpShort} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={60} />
              <Tooltip content={<ChartTip fmt={rp} labelFmt={(m) => monthLabel(m, true)} />} />
              {configs.map((c, i) => (
                <Line key={c.id} type="monotone" dataKey={c.id} name={c.nama} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card">
        <div className="section-title"><h2>Omset per brand × distributor</h2><span className="muted small">{monthLabel(month, true)}</span></div>
        <div className="grid-2">
          {CHANNELS.map((ch) => (
            <div key={ch} className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{ch === 'GT' ? 'Traditional (GT)' : 'Modern (MT)'}</th>
                    {list.filter((x) => x.hasData).map((x) => (
                      <th key={x.cfg.id} className="n"><span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}><span className="swatch" style={{ background: x.color }} />{x.cfg.nama}</span></th>
                    ))}
                    <th className="n">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix[ch].map((r) => (
                    <tr key={r.brand}>
                      <td>{r.brand}</td>
                      {list.filter((x) => x.hasData).map((x) => <td key={x.cfg.id} className="n">{r.by[x.cfg.id] ? rpShort(r.by[x.cfg.id]) : '–'}</td>)}
                      <td className="n"><b>{rpShort(r.total)}</b></td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Total {ch}</td>
                    {list.filter((x) => x.hasData).map((x) => <td key={x.cfg.id} className="n">{rpShort(x.s.omset[ch])}</td>)}
                    <td className="n">{rpShort(list.reduce((a, x) => a + x.s.omset[ch], 0))}</td>
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
