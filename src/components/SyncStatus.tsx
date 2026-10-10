import { useEffect, useState } from 'react'
import { getSyncState, login, logout, onSyncState, syncNow, type SyncState } from '../lib/sync'

const time = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '')

export default function SyncStatus() {
  const [s, setS] = useState<SyncState>(getSyncState())
  const [open, setOpen] = useState(false)
  const [pass, setPass] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const off = onSyncState(setS)
    return () => {
      off()
    }
  }, [])

  if (s.status === 'checking') return <span className="sync muted small">Memeriksa sinkron…</span>
  if (s.status === 'unavailable') {
    return (
      <span className="sync muted small" title="Sinkronisasi antar perangkat aktif bila website di-host di Cloudflare Pages (lihat README).">
        ● Lokal saja
      </span>
    )
  }

  const label =
    s.status === 'login' ? 'Masuk untuk sinkron'
    : s.status === 'syncing' ? 'Menyinkronkan…'
    : s.status === 'ok' ? (s.pending ? `${s.pending} perubahan menunggu` : `Tersinkron ${time(s.lastSync)}`)
    : s.status === 'offline' ? `Offline${s.pending ? ` · ${s.pending} menunggu` : ''}`
    : 'Gagal sinkron'
  const cls = s.status === 'ok' && !s.pending ? 'good' : s.status === 'error' || s.status === 'login' ? 'critical' : 'warning'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    const r = await login(pass)
    setBusy(false)
    if (r) setErr(r)
    else {
      setPass('')
      setOpen(false)
    }
  }

  return (
    <span className="sync-wrap">
      <button className={`sync status ${cls}`} onClick={() => setOpen(!open)} title={s.message}>
        <span className="dot" aria-hidden /> ☁ {label}
      </button>
      {open && (
        <div className="popover card">
          {s.status === 'login' ? (
            <form onSubmit={submit} className="stack" style={{ gap: 8 }}>
              <b>Sinkron antar perangkat</b>
              <span className="small text-2">Masukkan password SalesDeck. Cukup sekali per perangkat.</span>
              <input type="password" autoFocus value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Password" autoComplete="current-password" />
              {err && <span className="small" style={{ color: 'var(--critical-text)' }}>{err}</span>}
              <button className="btn primary" disabled={!pass || busy}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
            </form>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              <b>Sinkronisasi</b>
              <span className="small text-2">
                {s.lastSync ? `Terakhir sinkron ${time(s.lastSync)}.` : ''} {s.message ?? ''}
                {s.pending ? ` ${s.pending} perubahan belum terkirim.` : ''}
              </span>
              <button className="btn primary" onClick={() => syncNow(true)} disabled={s.status === 'syncing'}>Sinkron sekarang</button>
              <button className="btn" onClick={() => { logout(); setOpen(false) }}>Keluar dari perangkat ini</button>
            </div>
          )}
        </div>
      )}
    </span>
  )
}
