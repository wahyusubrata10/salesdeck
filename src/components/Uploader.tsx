import { useEffect, useRef, useState } from 'react'
import type { AppActions, PendingFile } from '../App'
import { SERIES } from '../lib/colors'
import { dateLabel } from '../lib/dates'
import { num } from '../lib/format'
import { detectDistributor, ingest, readFile } from '../lib/ingest'
import type { DistributorConfig } from '../lib/types'

interface Job {
  file: File
  status: 'baca' | 'proses' | 'ok' | 'perlu-atur' | 'gagal'
  distId?: string
  text?: string
}

// Upload file progress: distributor dikenali otomatis dari nama file & struktur sheet.
export default function Uploader({ configs, actions, compact, onManual }: {
  configs: DistributorConfig[]
  actions: AppActions
  compact: boolean
  onManual: (p: PendingFile) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [drag, setDrag] = useState(false)
  // Config terbaru selama satu batch (beberapa file bisa milik distributor berbeda).
  const cfgRef = useRef(configs)
  useEffect(() => {
    cfgRef.current = configs
  }, [configs])

  const setJob = (file: File, patch: Partial<Job>) =>
    setJobs((js) => js.map((j) => (j.file === file ? { ...j, ...patch } : j)))

  const handle = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => /\.(xlsx|xlsm|xls|csv)$/i.test(f.name))
    if (!list.length) return
    setJobs(list.map((file) => ({ file, status: 'baca' })))
    for (const file of list) {
      try {
        const { buf, sheets } = await readFile(file)
        const det = detectDistributor(file.name, sheets, cfgRef.current)
        if (!det) {
          setJob(file, { status: 'perlu-atur', text: 'Distributor tidak dikenali. Pilih distributornya:' })
          continue
        }
        if (!det.fits) {
          setJob(file, { status: 'perlu-atur', distId: det.cfg.id, text: `Mirip file ${det.cfg.nama}, tapi kolomnya berbeda dari pemetaan tersimpan.` })
          continue
        }
        setJob(file, { status: 'proses', distId: det.cfg.id })
        const res = await ingest(buf, file.name, sheets, det.cfg)
        await actions.applyIngest(res)
        const p = res.parse
        setJob(file, {
          status: 'ok',
          text: `${num(res.rows.length)} baris · ${p.minDate ? dateLabel(p.minDate) : ''} – ${p.maxDate ? dateLabel(p.maxDate) : ''}` +
            (res.newItems ? ` · ${res.newItems} barang baru di master` : '') +
            (p.itemError ? ` · master barang: ${p.itemError}` : ''),
        })
      } catch (e) {
        setJob(file, { status: 'gagal', text: e instanceof Error ? e.message : String(e) })
      }
    }
  }

  const busy = jobs.some((j) => j.status === 'baca' || j.status === 'proses')

  return (
    <div
      className={`card dropzone${drag ? ' drag' : ''}${compact ? ' compact' : ''}`}
      style={{ marginBottom: 16 }}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        handle(e.dataTransfer.files)
      }}
    >
      <div className="row">
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ fontSize: compact ? 14 : 16 }}>Upload file progress</h2>
          <div className="small text-2">
            Tarik 1–4 file Excel ke sini atau klik tombol. Distributor dikenali otomatis dan dashboard langsung diperbarui.
          </div>
        </div>
        <button className="btn primary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Memproses…' : 'Pilih file Excel'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xlsx,.xlsm,.xls,.csv"
          hidden
          onChange={(e) => {
            if (e.target.files) handle(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {jobs.length > 0 && (
        <ul className="jobs">
          {jobs.map((j) => {
            const idx = configs.findIndex((c) => c.id === j.distId)
            return (
              <li key={j.file.name + j.file.size}>
                <span className={`status ${j.status === 'ok' ? 'good' : j.status === 'gagal' ? 'critical' : j.status === 'perlu-atur' ? 'warning' : ''}`}>
                  {j.status === 'ok' ? '✓' : j.status === 'gagal' ? '✕' : j.status === 'perlu-atur' ? '!' : '…'}
                </span>
                <span className="small" style={{ fontWeight: 600 }}>{j.file.name}</span>
                {idx >= 0 && (
                  <span className="small row" style={{ gap: 4 }}>
                    → <span className="swatch" style={{ background: SERIES[idx] }} /> {configs[idx].nama}
                  </span>
                )}
                <span className="small text-2">
                  {j.status === 'baca' ? 'membaca…' : j.status === 'proses' ? 'memproses…' : j.text}
                </span>
                {j.status === 'perlu-atur' && (
                  <ManualPick configs={configs} initial={j.distId} onPick={(id) => onManual({ id, file: j.file })} />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ManualPick({ configs, initial, onPick }: { configs: DistributorConfig[]; initial?: string; onPick: (id: string) => void }) {
  const [id, setId] = useState(initial ?? configs[0].id)
  return (
    <span className="row" style={{ gap: 6 }}>
      <select value={id} onChange={(e) => setId(e.target.value)}>
        {configs.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}
      </select>
      <button className="btn" onClick={() => onPick(id)}>Atur pemetaan</button>
    </span>
  )
}
