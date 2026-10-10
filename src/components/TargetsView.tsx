import { useMemo, useState } from 'react'
import type { AppActions, AppData, Prepared } from '../App'
import { monthLabel, shiftMonth } from '../lib/dates'
import { rp } from '../lib/format'
import { brandShares, CHANNEL_LABEL, CHANNELS } from '../lib/metrics'
import { emptyTarget, type MonthTarget } from '../lib/types'
import { NumInput } from './ui'
import { SERIES } from '../lib/colors'

export default function TargetsView({ data, prepared, month, actions }: { data: AppData; prepared: Prepared; month: string; actions: AppActions }) {
  const [id, setId] = useState(data.configs[0].id)
  const cfg = data.configs.find((c) => c.id === id)!
  const rows = useMemo(() => prepared[id]?.rows ?? [], [prepared, id])
  const stored = data.targets[id]?.[month]
  const t: MonthTarget = { ...emptyTarget(), ...stored }
  const save = (next: MonthTarget) => actions.setTarget(id, month, next)

  // Grup brand per channel yang pernah muncul di data distributor ini.
  const brandNames = useMemo(() => {
    const out = { GT: new Set<string>(), MT: new Set<string>() }
    for (const r of rows) out[r.ch].add(r.b)
    for (const k of Object.keys(stored?.brand ?? {})) {
      const [ch, name] = k.split('|') as ['GT' | 'MT', string]
      out[ch]?.add(name)
    }
    return { GT: [...out.GT].sort(), MT: [...out.MT].sort() }
  }, [rows, stored])

  const splitByShare = () => {
    const months = [1, 2, 3].map((n) => shiftMonth(month, -n))
    const shares = brandShares(rows, months)
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

  return (
    <div className="stack">
      <div className="card">
        <div className="section-title">
          <h1>Target {monthLabel(month, true)}</h1>
          <span className="muted small">Tersimpan otomatis di browser ini</span>
        </div>
        <div className="row">
          {data.configs.map((c, i) => (
            <button key={c.id} className={`tab${c.id === id ? ' active' : ''}`} onClick={() => setId(c.id)}>
              <span className="swatch" style={{ background: SERIES[i] }} />
              {c.nama}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <button className="btn" disabled={!prev} onClick={() => prev && save(structuredClone(prev))}>
            Salin dari {monthLabel(shiftMonth(month, -1))}
          </button>
        </div>
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
          <button className="btn" onClick={splitByShare} disabled={!t.GT.omset && !t.MT.omset}>
            Bagi target omset sesuai kontribusi 3 bulan terakhir
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
                    <thead><tr><th>Brand</th><th className="n">Target omset</th><th className="n">Target EA</th></tr></thead>
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
                          </tr>
                        )
                      })}
                      <tr className="total">
                        <td>Jumlah</td>
                        <td className="n">{rp(sum)}</td>
                        <td />
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
    </div>
  )
}
