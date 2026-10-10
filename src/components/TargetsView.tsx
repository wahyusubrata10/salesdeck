import { useMemo, useState } from 'react'
import type { AppActions, AppData, Prepared } from '../App'
import { monthLabel, monthOf, shiftMonth, todayYmd } from '../lib/dates'
import { rp, rpShort } from '../lib/format'
import { brandShares, CHANNEL_LABEL, CHANNELS } from '../lib/metrics'
import { emptyTarget, isTargetFilled, type MonthTarget } from '../lib/types'
import { NumInput } from './ui'
import { SERIES } from '../lib/colors'

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export interface TargetFocus {
  month: string
  id?: string
}

export default function TargetsView({ data, prepared, focus, actions }: { data: AppData; prepared: Prepared; focus: TargetFocus; actions: AppActions }) {
  const [id, setId] = useState(focus.id ?? data.configs[0].id)
  const [month, setMonth] = useState(focus.month)
  const cfg = data.configs.find((c) => c.id === id)!
  const rows = useMemo(() => prepared[id]?.rows ?? [], [prepared, id])
  const stored = data.targets[id]?.[month]
  const t: MonthTarget = { ...emptyTarget(), ...stored }
  const save = (next: MonthTarget) => actions.setTarget(id, month, next)
  const [year, mon] = month.split('-').map(Number)
  const setYM = (y: number, m: number) => setMonth(`${y}-${String(m).padStart(2, '0')}`)

  // Bulan untuk tabel status: dari bulan data paling awal sampai 2 bulan ke depan.
  const statusMonths = useMemo(() => {
    let min = monthOf(todayYmd())
    for (const p of Object.values(prepared)) for (const r of p.rows) if (monthOf(r.d) < min) min = monthOf(r.d)
    // Bulan yang sudah punya target juga ditampilkan, meski datanya belum di-upload.
    for (const months of Object.values(data.targets)) for (const m of Object.keys(months)) if (m < min) min = m
    const out: string[] = []
    const last = shiftMonth(monthOf(todayYmd()), 2)
    for (let m = min; m <= last && out.length < 24; m = shiftMonth(m, 1)) out.push(m)
    return out.reverse()
  }, [prepared, data.targets])

  // Grup brand per channel yang pernah muncul di data semua distributor
  // (agar brand yang belum terjual di distributor ini tetap bisa diberi target).
  const brandNames = useMemo(() => {
    const out = { GT: new Set<string>(), MT: new Set<string>() }
    for (const p of Object.values(prepared)) for (const r of p.rows) if (r.b !== 'LAINNYA') out[r.ch].add(r.b)
    for (const k of Object.keys(stored?.brand ?? {})) {
      const [ch, name] = k.split('|') as ['GT' | 'MT', string]
      out[ch]?.add(name)
    }
    return { GT: [...out.GT].sort(), MT: [...out.MT].sort() }
  }, [prepared, stored])

  // Kontribusi brand dari 3 bulan terakhir yang punya data sebelum bulan target.
  const shareMonths = useMemo(() => {
    const ms = [...new Set(rows.map((r) => monthOf(r.d)))].filter((m) => m < month).sort()
    return ms.slice(-3)
  }, [rows, month])

  const splitByShare = () => {
    const shares = brandShares(rows, shareMonths)
    const brand: MonthTarget['brand'] = {}
    for (const ch of CHANNELS) {
      for (const b of brandNames[ch]) {
        const k = `${ch}|${b}`
        const sh = shares[k] ?? 0
        brand[k] = { omset: Math.round(t[ch].omset * sh), ea: t.brand[k]?.ea ?? 0 }
      }
    }
    save({ ...t, brand })
  }

  const prev = data.targets[id]?.[shiftMonth(month, -1)]
  const thisYear = Number(todayYmd().slice(0, 4))

  return (
    <div className="stack">
      <div className="card">
        <div className="section-title">
          <h1>Input target</h1>
          <span className="muted small">Tersimpan otomatis &amp; tersinkron ke semua perangkat</span>
        </div>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field">
            Bulan
            <select value={mon} onChange={(e) => setYM(year, +e.target.value)}>
              {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
            </select>
          </label>
          <label className="field">
            Tahun
            <select value={year} onChange={(e) => setYM(+e.target.value, mon)}>
              {[thisYear - 1, thisYear, thisYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <span style={{ width: 8 }} />
          {data.configs.map((c, i) => (
            <button key={c.id} className={`tab${c.id === id ? ' active' : ''}`} onClick={() => setId(c.id)}>
              <span className="swatch" style={{ background: SERIES[i] }} />
              {c.nama}
              {!isTargetFilled(data.targets[c.id]?.[month]) && <span className="status warning" title="Belum diisi">!</span>}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <button className="btn" disabled={!prev} onClick={() => prev && save(structuredClone(prev))}>
            Salin dari {monthLabel(shiftMonth(month, -1))}
          </button>
        </div>
        <h2 style={{ marginTop: 14 }}>
          {cfg.nama} · {monthLabel(month, true)}{' '}
          {isTargetFilled(stored) ? <span className="status good">✓ sudah diisi</span> : <span className="status warning">! belum diisi</span>}
        </h2>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Target utama · {cfg.nama}</h2>
        <div className="row" style={{ alignItems: 'flex-end', gap: 16 }}>
          {CHANNELS.map((ch) => (
            <div key={ch} className="row" style={{ gap: 8 }}>
              <label className="field">Omset {ch}<NumInput value={t[ch].omset} onChange={(v) => save({ ...t, [ch]: { ...t[ch], omset: v } })} /></label>
              <label className="field">EA {ch}<NumInput small value={t[ch].ea} onChange={(v) => save({ ...t, [ch]: { ...t[ch], ea: v } })} /></label>
            </div>
          ))}
          <label className="field">EC / HK<NumInput small decimals value={t.ecHk} onChange={(v) => save({ ...t, ecHk: v })} /></label>
          <label className="field">Assortment / EA GT<NumInput small decimals value={t.asrt} onChange={(v) => save({ ...t, asrt: v })} /></label>
        </div>
        <p className="small text-2" style={{ marginBottom: 0 }}>Total target omset: <b>{rp(t.GT.omset + t.MT.omset)}</b></p>
      </div>

      <div className="card">
        <div className="section-title">
          <h2>Target per brand</h2>
          <button className="btn" onClick={splitByShare} disabled={(!t.GT.omset && !t.MT.omset) || !shareMonths.length}
            title={shareMonths.length ? `Kontribusi ${shareMonths.map((m) => monthLabel(m)).join(', ')}` : 'Belum ada data bulan sebelumnya'}>
            Bagi target omset sesuai kontribusi {shareMonths.length || 3} bulan terakhir
          </button>
        </div>
        <div className="grid-2">
          {CHANNELS.map((ch) => {
            const sum = brandNames[ch].reduce((a, b) => a + (t.brand[`${ch}|${b}`]?.omset ?? 0), 0)
            return (
              <div key={ch}>
                <h3 style={{ marginBottom: 6 }}>{CHANNEL_LABEL[ch]}</h3>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Brand</th><th className="n">Target omset</th><th className="n">Target EA</th>{ch === 'GT' && <th className="n">SKU / EA</th>}</tr></thead>
                    <tbody>
                      {brandNames[ch].map((b) => {
                        const k = `${ch}|${b}`
                        const line = t.brand[k] ?? { omset: 0, ea: 0 }
                        const setLine = (patch: Partial<typeof line>) => save({ ...t, brand: { ...t.brand, [k]: { ...line, ...patch } } })
                        return (
                          <tr key={k}>
                            <td>{b}</td>
                            <td className="n"><NumInput value={line.omset} onChange={(v) => setLine({ omset: v })} /></td>
                            <td className="n"><NumInput small value={line.ea} onChange={(v) => setLine({ ea: v })} /></td>
                            {ch === 'GT' && (
                              <td className="n">
                                <NumInput small decimals value={t.asrtBrand?.[b] ?? 0} onChange={(v) => save({ ...t, asrtBrand: { ...t.asrtBrand, [b]: v } })} />
                              </td>
                            )}
                          </tr>
                        )
                      })}
                      <tr className="total">
                        <td>Jumlah</td>
                        <td className="n">{rp(sum)}</td>
                        <td />
                        {ch === 'GT' && <td />}
                      </tr>
                    </tbody>
                  </table>
                </div>
                {t[ch].omset > 0 && Math.abs(sum - t[ch].omset) > 1 && sum > 0 && (
                  <div className="notice warn small" style={{ marginTop: 8 }}>
                    Jumlah target brand ({rp(sum)}) berbeda dengan target {ch} ({rp(t[ch].omset)}).
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className="card">
        <div className="section-title">
          <h2>Status target</h2>
          <span className="muted small">Klik sel untuk mengisi</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bulan</th>
                {data.configs.map((c, i) => (
                  <th key={c.id} className="n"><span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}><span className="swatch" style={{ background: SERIES[i] }} />{c.nama}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statusMonths.map((m) => (
                <tr key={m} className={m === month ? 'selected' : undefined}>
                  <td>{monthLabel(m, true)}</td>
                  {data.configs.map((c) => {
                    const tt = data.targets[c.id]?.[m]
                    const filled = isTargetFilled(tt)
                    return (
                      <td key={c.id} className="n">
                        <button className={`cellbtn${filled ? '' : ' empty'}`} onClick={() => { setMonth(m); setId(c.id) }}>
                          {filled ? rpShort(tt!.GT.omset + tt!.MT.omset) : 'Isi target'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
