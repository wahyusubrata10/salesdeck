import { useEffect, useMemo, useState } from 'react'
import DistributorView from './components/DistributorView'
import Overview from './components/Overview'
import SettingsView from './components/SettingsView'
import TargetsView from './components/TargetsView'
import { SERIES } from './lib/colors'
import { monthLabel, monthOf, todayYmd } from './lib/dates'
import { loadAll, saveConfigs, saveRows, saveTargets } from './lib/store'
import type { DistributorConfig, MonthTarget, SaleRow, Targets } from './lib/types'

export interface AppData {
  configs: DistributorConfig[]
  rows: Record<string, SaleRow[]>
  targets: Targets
}

export interface AppActions {
  updateConfig: (c: DistributorConfig) => void
  replaceRows: (id: string, rows: SaleRow[]) => Promise<void>
  setTarget: (id: string, month: string, t: MonthTarget) => void
  replaceAll: (configs: DistributorConfig[], targets: Targets) => void
}

type Tab = 'overview' | 'targets' | 'settings' | string

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [month, setMonth] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
      .then((d) => {
        setData(d)
        if (d.configs.every((c) => !d.rows[c.id]?.length)) setTab('settings')
      })
      .catch((e) => setError(String(e)))
  }, [])

  // Bulan yang tersedia di data (gabungan semua distributor).
  const months = useMemo(() => {
    const s = new Set<string>([monthOf(todayYmd())])
    if (data) for (const rows of Object.values(data.rows)) for (const r of rows) s.add(monthOf(r.d))
    return [...s].sort().reverse()
  }, [data])

  // Default: bulan terbaru yang punya data.
  const latestDataMonth = useMemo(() => {
    let m: string | null = null
    if (data) for (const rows of Object.values(data.rows)) for (const r of rows) if (!m || r.d > m) m = r.d
    return m ? monthOf(m) : monthOf(todayYmd())
  }, [data])
  const activeMonth = month ?? latestDataMonth

  if (error) return <div className="app"><div className="notice err">Gagal memuat data: {error}</div></div>
  if (!data) return <div className="app"><div className="empty">Memuat…</div></div>

  const actions: AppActions = {
    updateConfig: (c) =>
      setData((d) => {
        if (!d) return d
        const configs = d.configs.map((x) => (x.id === c.id ? c : x))
        saveConfigs(configs)
        return { ...d, configs }
      }),
    replaceRows: async (id, rows) => {
      await saveRows(id, rows)
      setData((d) => (d ? { ...d, rows: { ...d.rows, [id]: rows } } : d))
    },
    setTarget: (id, m, t) =>
      setData((d) => {
        if (!d) return d
        const targets = { ...d.targets, [id]: { ...(d.targets[id] ?? {}), [m]: t } }
        saveTargets(targets)
        return { ...d, targets }
      }),
    replaceAll: (configs, targets) => {
      saveConfigs(configs)
      saveTargets(targets)
      setData((d) => (d ? { ...d, configs, targets } : d))
    },
  }

  const dist = data.configs.find((c) => c.id === tab)

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">SalesDeck</span>
        <nav className="tabs">
          <button className={`tab${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>Ringkasan</button>
          {data.configs.map((c, i) => (
            <button key={c.id} className={`tab${tab === c.id ? ' active' : ''}`} onClick={() => setTab(c.id)}>
              <span className="swatch" style={{ background: SERIES[i] }} />
              {c.nama}
            </button>
          ))}
          <button className={`tab${tab === 'targets' ? ' active' : ''}`} onClick={() => setTab('targets')}>Target</button>
          <button className={`tab${tab === 'settings' ? ' active' : ''}`} onClick={() => setTab('settings')}>Data &amp; Pengaturan</button>
        </nav>
        {tab !== 'settings' && (
          <label className="row small text-2" style={{ gap: 6 }}>
            Bulan
            <select value={activeMonth} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m} value={m}>{monthLabel(m, true)}</option>
              ))}
            </select>
          </label>
        )}
      </header>

      {tab === 'overview' && <Overview data={data} month={activeMonth} onOpen={setTab} />}
      {dist && (
        <DistributorView
          cfg={dist}
          color={SERIES[data.configs.indexOf(dist)]}
          rows={data.rows[dist.id] ?? []}
          target={data.targets[dist.id]?.[activeMonth]}
          month={activeMonth}
        />
      )}
      {tab === 'targets' && <TargetsView data={data} month={activeMonth} actions={actions} />}
      {tab === 'settings' && <SettingsView data={data} actions={actions} />}
    </div>
  )
}
