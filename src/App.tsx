import { useEffect, useMemo, useState } from 'react'
import DistributorView from './components/DistributorView'
import Overview from './components/Overview'
import SettingsView from './components/SettingsView'
import TargetsView from './components/TargetsView'
import Uploader from './components/Uploader'
import { SERIES } from './lib/colors'
import { monthLabel, monthOf, todayYmd } from './lib/dates'
import type { IngestResult } from './lib/ingest'
import { enrich, type EnrichStats, type Row } from './lib/metrics'
import { loadAll, saveConfigs, saveRows, saveTargets } from './lib/store'
import type { DistributorConfig, MonthTarget, SaleRow, Targets } from './lib/types'

export interface AppData {
  configs: DistributorConfig[]
  rows: Record<string, SaleRow[]>
  targets: Targets
}

// Data siap pakai per distributor (aturan sudah diterapkan).
export type Prepared = Record<string, { rows: Row[]; stats: EnrichStats }>

export interface AppActions {
  updateConfig: (c: DistributorConfig) => void
  replaceRows: (id: string, rows: SaleRow[]) => Promise<void>
  applyIngest: (res: IngestResult) => Promise<void>
  setTarget: (id: string, month: string, t: MonthTarget) => void
  replaceAll: (configs: DistributorConfig[], targets: Targets) => void
}

export interface PendingFile {
  id: string // distributor tujuan
  file: File
}

type Tab = 'overview' | 'targets' | 'settings' | string

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [month, setMonth] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingFile | null>(null)

  useEffect(() => {
    loadAll()
      .then(setData)
      .catch((e) => setError(String(e)))
  }, [])

  const prepared: Prepared = useMemo(() => {
    const out: Prepared = {}
    if (data) for (const c of data.configs) out[c.id] = enrich(c, data.rows[c.id] ?? [])
    return out
  }, [data])

  // Bulan yang tersedia di data (gabungan semua distributor), terbaru dulu.
  const { months, latest } = useMemo(() => {
    const s = new Set<string>([monthOf(todayYmd())])
    let max: string | null = null
    for (const p of Object.values(prepared))
      for (const r of p.rows) {
        s.add(monthOf(r.d))
        if (!max || r.d > max) max = r.d
      }
    return { months: [...s].sort().reverse(), latest: max ? monthOf(max) : monthOf(todayYmd()) }
  }, [prepared])
  const activeMonth = month ?? latest

  if (error) return <div className="app"><div className="notice err">Gagal memuat data: {error}</div></div>
  if (!data) return <div className="app"><div className="empty">Memuat…</div></div>

  const updateConfig = (c: DistributorConfig) =>
    setData((d) => {
      if (!d) return d
      const configs = d.configs.map((x) => (x.id === c.id ? c : x))
      saveConfigs(configs)
      return { ...d, configs }
    })
  const replaceRows = async (id: string, rows: SaleRow[]) => {
    await saveRows(id, rows)
    setData((d) => (d ? { ...d, rows: { ...d.rows, [id]: rows } } : d))
  }

  const actions: AppActions = {
    updateConfig,
    replaceRows,
    applyIngest: async (res) => {
      await replaceRows(res.cfg.id, res.rows)
      updateConfig(res.cfg)
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
  const hasAnyData = data.configs.some((c) => data.rows[c.id]?.length)

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

      {(tab === 'overview' || tab === 'settings' || !hasAnyData) && tab !== 'targets' && (
        <Uploader
          configs={data.configs}
          actions={actions}
          compact={hasAnyData}
          onManual={(p) => {
            setPending(p)
            setTab('settings')
          }}
        />
      )}

      {tab === 'overview' && hasAnyData && (
        <Overview configs={data.configs} prepared={prepared} targets={data.targets} month={activeMonth} onOpen={setTab} />
      )}
      {dist && (data.rows[dist.id]?.length ?? 0) > 0 && (
        <DistributorView
          key={dist.id}
          cfg={dist}
          color={SERIES[data.configs.indexOf(dist)]}
          prepared={prepared[dist.id]}
          target={data.targets[dist.id]?.[activeMonth]}
          month={activeMonth}
        />
      )}
      {dist && !(data.rows[dist.id]?.length) && hasAnyData && (
        <div className="card empty">
          <h2>{dist.nama}</h2>
          <p>Belum ada data. Upload file progress di tab <b>Ringkasan</b> atau <b>Data &amp; Pengaturan</b>.</p>
        </div>
      )}
      {tab === 'targets' && <TargetsView data={data} prepared={prepared} month={activeMonth} actions={actions} />}
      {tab === 'settings' && (
        <SettingsView data={data} prepared={prepared} actions={actions} pending={pending} onPendingDone={() => setPending(null)} />
      )}
    </div>
  )
}
