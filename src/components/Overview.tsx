import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { AppData } from '../App'
import { dateLabel, monthLabel, timeGone } from '../lib/dates'
import { dec, num, pct, rp, rpShort } from '../lib/format'
import { monthlyTotals, summarize } from '../lib/metrics'
import { AchBar, ChartTip, Kpi, Legend, StatusBadge } from './ui'
import { SERIES } from '../lib/colors'

export default function Overview({ data, month, onOpen }: { data: AppData; month: string; onOpen: (id: string) => void }) {
  const list = useMemo(
    () =>
      data.configs.map((cfg, i) => ({
        cfg,
        color: SERIES[i],
        hasData: (data.rows[cfg.id]?.length ?? 0) > 0,
        s: summarize(cfg, data.rows[cfg.id] ?? [], month, data.targets[cfg.id]?.[month]),
      })),
    [data, month],
  )

  const tg = timeGone(month)
  const omset = list.reduce((a, x) => a + x.s.omset.total, 0)
  const target = list.reduce((a, x) => a + x.s.target.total, 0)
  const est = list.reduce((a, x) => a + x.s.estClosing, 0)
  const ach = target > 0 ? omset / target : null

  const trend = useMemo(() => {
    const byMonth = new Map<string, Record<string, number | string>>()
    data.configs.forEach((cfg) => {
      for (const t of monthlyTotals(cfg, data.rows[cfg.id] ?? [])) {
        const row = byMonth.get(t.month) ?? { month: t.month }
        row[cfg.id] = t.total
        byMonth.set(t.month, row)
      }
    })
    return [...byMonth.values()].sort((a, b) => String(a.month).localeCompare(String(b.month))).slice(-12)
  }, [data])

  const achData = list.filter((x) => x.s.ach != null).map((x) => ({ name: x.cfg.nama, id: x.cfg.id, ach: x.s.ach, color: x.color }))

  if (list.every((x) => !x.hasData)) {
    return (
      <div className="card empty">
        <h2>Belum ada data</h2>
        <p>Buka tab <b>Data &amp; Pengaturan</b> untuk upload file Excel tiap distributor.</p>
      </div>
    )
  }

  return (
    <div className="stack">
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
            <div className="empty small">Isi target di tab <b>Target</b> untuk melihat pencapaian.</div>
          )}
        </div>

        <div className="card">
          <div className="section-title"><h2>Tren omset bulanan</h2></div>
          <Legend items={data.configs.map((c, i) => ({ label: c.nama, color: SERIES[i], kind: 'line' as const }))} />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend} margin={{ left: 0, right: 16, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m)} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <YAxis tickFormatter={rpShort} stroke="var(--axis)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={60} />
              <Tooltip content={<ChartTip fmt={rp} labelFmt={(m) => monthLabel(m, true)} />} />
              {data.configs.map((c, i) => (
                <Line key={c.id} type="monotone" dataKey={c.id} name={c.nama} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
