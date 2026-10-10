import { useMemo, useRef, useState } from 'react'
import type { AppActions, AppData } from '../App'
import { inspectWorkbook, parseWorkbook, rankSheets, type SheetInfo } from '../lib/excel'
import { dedupeHeaders, FIELDS, guessChannel, guessMapping } from '../lib/fields'
import { dateLabel } from '../lib/dates'
import { num, rp } from '../lib/format'
import { deleteRows, type Backup } from '../lib/store'
import { parseDate } from '../lib/values'
import type { Channel, DistributorConfig, FieldKey, SaleRow } from '../lib/types'
import { SERIES } from '../lib/colors'

export default function SettingsView({ data, actions }: { data: AppData; actions: AppActions }) {
  const importRef = useRef<HTMLInputElement>(null)

  const exportBackup = () => {
    const b: Backup = { version: 1, configs: data.configs, targets: data.targets }
    const url = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `salesdeck-pengaturan-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importBackup = async (f: File) => {
    try {
      const b = JSON.parse(await f.text()) as Backup
      if (b.version !== 1 || !Array.isArray(b.configs)) throw new Error('Format file tidak dikenali')
      actions.replaceAll(b.configs, b.targets ?? {})
      alert('Pengaturan & target berhasil dipulihkan. Upload ulang file Excel bila data belum ada.')
    } catch (e) {
      alert(`Gagal import: ${e instanceof Error ? e.message : e}`)
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="section-title">
          <h1>Data &amp; Pengaturan</h1>
          <div className="row">
            <button className="btn" onClick={exportBackup}>Export pengaturan &amp; target</button>
            <button className="btn" onClick={() => importRef.current?.click()}>Import</button>
            <input ref={importRef} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
          </div>
        </div>
        <p className="small text-2" style={{ margin: 0 }}>
          Setiap distributor punya format header Excel sendiri. Upload file, cek pemetaan kolom, lalu simpan. Upload berikutnya
          akan memakai pemetaan yang sama secara otomatis. Semua data hanya tersimpan di browser ini dan tidak dikirim ke server.
        </p>
      </div>
      {data.configs.map((c, i) => (
        <DistributorSetup key={c.id} cfg={c} color={SERIES[i]} rows={data.rows[c.id] ?? []} actions={actions} />
      ))}
    </div>
  )
}

interface Draft {
  buf: ArrayBuffer
  fileName: string
  sheets: SheetInfo[]
  sheet: string
  headerRow: number
  mapping: Partial<Record<FieldKey, string>>
}

function DistributorSetup({ cfg, color, rows, actions }: { cfg: DistributorConfig; color: string; rows: SaleRow[]; actions: AppActions }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const range = useMemo(() => {
    let min = '', max = ''
    for (const r of rows) {
      if (!min || r.d < min) min = r.d
      if (!max || r.d > max) max = r.d
    }
    return min ? `${dateLabel(min)} – ${dateLabel(max)}` : null
  }, [rows])

  const onFile = async (f: File) => {
    setMsg(null)
    setBusy('Membaca file…')
    try {
      const buf = await f.arrayBuffer()
      const sheets = await inspectWorkbook(buf)
      const saved = cfg.sheet ? sheets.find((s) => s.name === cfg.sheet) : undefined
      const savedOk = saved && Object.values(cfg.mapping).every((h) => !h || saved.headers.includes(h))
      const sheet = savedOk ? saved : rankSheets(sheets)[0]
      setDraft({
        buf,
        fileName: f.name,
        sheets,
        sheet: sheet.name,
        headerRow: sheet.headerRow,
        mapping: savedOk ? { ...cfg.mapping } : guessMapping(sheet.headers),
      })
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  const sheetInfo = draft?.sheets.find((s) => s.name === draft.sheet)
  const headers = sheetInfo && draft ? dedupeHeaders(sheetInfo.top[draft.headerRow] ?? []) : []
  const preview = sheetInfo && draft ? sheetInfo.top.slice(draft.headerRow + 1, draft.headerRow + 6) : []

  const setHeaderRow = (n: number) => {
    const hr = Math.max(0, Math.min(n, sheetInfo!.top.length - 2))
    setDraft({ ...draft!, headerRow: hr, mapping: guessMapping(dedupeHeaders(sheetInfo!.top[hr] ?? [])) })
  }

  const pickSheet = (name: string) => {
    const s = draft!.sheets.find((x) => x.name === name)!
    setDraft({ ...draft!, sheet: name, headerRow: s.headerRow, mapping: guessMapping(s.headers) })
  }

  const missing = draft ? FIELDS.filter((f) => f.required && !draft.mapping[f.key]) : []

  const process = async () => {
    if (!draft) return
    setBusy('Memproses data…')
    setMsg(null)
    try {
      const res = await parseWorkbook(draft.buf, draft.sheet, draft.headerRow, draft.mapping)
      if (!res.rows.length) throw new Error('Tidak ada baris valid. Periksa pemetaan kolom Tanggal dan Kode Customer.')
      const channelMap = { ...cfg.channelMap }
      for (const r of res.rows) if (!(r.kt in channelMap)) channelMap[r.kt] = guessChannel(r.kt)
      await actions.replaceRows(cfg.id, res.rows)
      actions.updateConfig({
        ...cfg,
        sheet: draft.sheet,
        headerRow: draft.headerRow,
        mapping: draft.mapping,
        channelMap,
        fileName: draft.fileName,
        updatedAt: new Date().toISOString(),
        rowCount: res.rows.length,
      })
      setMsg({
        kind: 'ok',
        text: `${num(res.rows.length)} baris tersimpan (${res.minDate ? dateLabel(res.minDate) : ''} – ${res.maxDate ? dateLabel(res.maxDate) : ''})${res.skipped ? `, ${num(res.skipped)} baris dilewati karena tanggal/kode customer kosong` : ''}.`,
      })
      setDraft(null)
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  const clear = async () => {
    if (!confirm(`Hapus semua data transaksi ${cfg.nama}? Pemetaan & target tetap disimpan.`)) return
    await deleteRows(cfg.id)
    await actions.replaceRows(cfg.id, [])
    actions.updateConfig({ ...cfg, rowCount: 0, fileName: undefined, updatedAt: undefined })
  }

  return (
    <div className="card stack" style={{ gap: 12 }}>
      <div className="row">
        <span className="swatch" style={{ background: color, width: 14, height: 14 }} />
        <input value={cfg.nama} onChange={(e) => actions.updateConfig({ ...cfg, nama: e.target.value })} style={{ fontWeight: 600, width: 260 }} aria-label="Nama distributor" />
        <span className="small text-2" style={{ flex: 1 }}>
          {rows.length ? `${num(rows.length)} baris · ${range} · ${cfg.fileName ?? ''}` : 'Belum ada data'}
          {cfg.updatedAt && ` · diupdate ${new Date(cfg.updatedAt).toLocaleString('id-ID')}`}
        </span>
        <button className="btn primary" onClick={() => fileRef.current?.click()} disabled={!!busy}>
          {rows.length ? 'Upload ulang Excel' : 'Upload Excel'}
        </button>
        {rows.length > 0 && <button className="btn danger" onClick={clear}>Hapus data</button>}
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls,.csv" hidden onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.target.value = '' }} />
      </div>

      {busy && <div className="notice">{busy}</div>}
      {msg && <div className={`notice ${msg.kind === 'err' ? 'err' : ''}`}>{msg.text}</div>}

      {draft && sheetInfo && (
        <div className="stack" style={{ gap: 12, borderTop: '1px solid var(--grid)', paddingTop: 12 }}>
          <h3>Pemetaan kolom · {draft.fileName}</h3>
          <div className="row">
            <label className="field">
              Sheet data
              <select value={draft.sheet} onChange={(e) => pickSheet(e.target.value)}>
                {rankSheets(draft.sheets).map((s) => (
                  <option key={s.name} value={s.name}>{s.name} ({s.score} kolom dikenali, ±{num(s.rows)} baris)</option>
                ))}
              </select>
            </label>
            <label className="field">
              Baris header ke-
              <input
                type="number"
                min={1}
                value={draft.headerRow + 1}
                style={{ width: 80 }}
                max={sheetInfo.top.length - 1}
                onChange={(e) => setHeaderRow((+e.target.value || 1) - 1)}
              />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Kolom dashboard</th><th>Header di Excel</th><th>Contoh nilai</th><th>Fungsi</th></tr></thead>
              <tbody>
                {FIELDS.map((f) => {
                  const h = draft.mapping[f.key]
                  const idx = h ? headers.indexOf(h) : -1
                  const sample = idx >= 0 ? preview.map((r) => r[idx]).filter((v) => v != null && v !== '').slice(0, 3).map((v) => (f.key === 'tanggal' ? (parseDate(v) ? dateLabel(parseDate(v)!) : `${v} (tidak terbaca)`) : String(v))).join(' · ') : ''
                  return (
                    <tr key={f.key}>
                      <td>{f.label}{f.required && <b style={{ color: 'var(--critical-text)' }}> *</b>}</td>
                      <td>
                        <select value={h ?? ''} onChange={(e) => setDraft({ ...draft, mapping: { ...draft.mapping, [f.key]: e.target.value || undefined } })}>
                          <option value="">— tidak ada —</option>
                          {headers.map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                      </td>
                      <td className="small text-2" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{sample}</td>
                      <td className="small muted">{f.hint}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="row">
            <button className="btn primary" disabled={!!busy || missing.length > 0} onClick={process}>Proses &amp; simpan</button>
            <button className="btn" onClick={() => setDraft(null)}>Batal</button>
            {missing.length > 0 && <span className="small" style={{ color: 'var(--critical-text)' }}>Wajib dipetakan: {missing.map((m) => m.label).join(', ')}</span>}
          </div>
        </div>
      )}

      {rows.length > 0 && !draft && <ValueMappings cfg={cfg} rows={rows} actions={actions} />}
    </div>
  )
}

function ValueMappings({ cfg, rows, actions }: { cfg: DistributorConfig; rows: SaleRow[]; actions: AppActions }) {
  const [open, setOpen] = useState(false)
  const stats = useMemo(() => {
    const kt = new Map<string, { n: number; om: number }>()
    const br = new Map<string, { n: number; om: number }>()
    for (const r of rows) {
      const a = kt.get(r.kt) ?? { n: 0, om: 0 }
      a.n++; a.om += r.om; kt.set(r.kt, a)
      const b = br.get(r.br) ?? { n: 0, om: 0 }
      b.n++; b.om += r.om; br.set(r.br, b)
    }
    const sort = (m: Map<string, { n: number; om: number }>) => [...m.entries()].sort((x, y) => y[1].om - x[1].om)
    return { kt: sort(kt), br: sort(br) }
  }, [rows])

  return (
    <div style={{ borderTop: '1px solid var(--grid)', paddingTop: 12 }}>
      <button className="btn" onClick={() => setOpen(!open)}>{open ? 'Tutup' : 'Atur'} pemetaan GT/MT &amp; grup brand</button>
      {open && (
        <div className="grid-2" style={{ marginTop: 12 }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Channel (GT / MT)</h3>
            {cfg.mapping.kategori ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Nilai "{cfg.mapping.kategori}"</th><th className="n">Baris</th><th className="n">Omset</th><th>Channel</th></tr></thead>
                  <tbody>
                    {stats.kt.map(([v, s]) => (
                      <tr key={v}>
                        <td>{v || <span className="muted">(kosong)</span>}</td>
                        <td className="n">{num(s.n)}</td>
                        <td className="n">{rp(s.om)}</td>
                        <td>
                          <select value={cfg.channelMap[v] ?? guessChannel(v)} onChange={(e) => actions.updateConfig({ ...cfg, channelMap: { ...cfg.channelMap, [v]: e.target.value as Channel } })}>
                            <option value="GT">GT (Traditional)</option>
                            <option value="MT">MT (Modern)</option>
                            <option value="X">Abaikan</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <label className="field">
                Kolom kategori tidak dipetakan. Semua transaksi dihitung sebagai:
                <select value={cfg.defaultChannel} onChange={(e) => actions.updateConfig({ ...cfg, defaultChannel: e.target.value as Channel })}>
                  <option value="GT">GT (Traditional)</option>
                  <option value="MT">MT (Modern)</option>
                </select>
              </label>
            )}
          </div>
          <div>
            <h3 style={{ marginBottom: 6 }}>Grup brand</h3>
            <p className="small muted" style={{ marginTop: 0 }}>Samakan nama brand antar distributor, mis. "HILO TRADITIONAL" → "HI LO". Kosongkan untuk memakai nama asli.</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Brand di Excel</th><th className="n">Omset</th><th>Grup</th></tr></thead>
                <tbody>
                  {stats.br.map(([v, s]) => (
                    <tr key={v}>
                      <td>{v || <span className="muted">(kosong)</span>}</td>
                      <td className="n">{rp(s.om)}</td>
                      <td>
                        <input
                          defaultValue={cfg.brandMap[v] ?? ''}
                          placeholder={v || 'LAINNYA'}
                          onBlur={(e) => actions.updateConfig({ ...cfg, brandMap: { ...cfg.brandMap, [v]: e.target.value.trim() } })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
