import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppActions, AppData, PendingFile, Prepared } from '../App'
import { SERIES } from '../lib/colors'
import { dateLabel } from '../lib/dates'
import type { SheetInfo } from '../lib/excel'
import { rankSheets } from '../lib/excel'
import { FIELDS, guessChannel, guessMapping, guessTrx, missingFields } from '../lib/fields'
import { num, rp } from '../lib/format'
import { findSheet, headersAt, ingest, readFile } from '../lib/ingest'
import { rawBrand, rawChannel, type EnrichStats } from '../lib/metrics'
import { PRESETS } from '../lib/presets'
import { deleteRows, type Backup } from '../lib/store'
import type { Channel, DistributorConfig, ItemInfo, ItemSource, Mapping, SaleRow, TrxKind } from '../lib/types'
import { parseDate, parseNumber } from '../lib/values'

interface Props {
  data: AppData
  prepared: Prepared
  actions: AppActions
  pending: PendingFile | null
  onPendingDone: () => void
}

export default function SettingsView({ data, prepared, actions, pending, onPendingDone }: Props) {
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

  const resetPresets = () => {
    if (!confirm('Kembalikan pemetaan semua distributor ke preset bawaan? Data transaksi, target, dan master barang tetap disimpan.')) return
    actions.replaceAll(
      data.configs.map((c) => {
        const p = structuredClone(PRESETS.find((x) => x.id === c.id) ?? c)
        return { ...p, items: { ...p.items, ...c.items }, fileName: c.fileName, updatedAt: c.updatedAt, rowCount: c.rowCount }
      }),
      data.targets,
    )
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="section-title">
          <h1>Data &amp; Pengaturan</h1>
          <div className="row">
            <button className="btn" onClick={resetPresets}>Kembalikan preset bawaan</button>
            <button className="btn" onClick={exportBackup}>Export pengaturan &amp; target</button>
            <button className="btn" onClick={() => importRef.current?.click()}>Import</button>
            <input ref={importRef} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
          </div>
        </div>
        <p className="small text-2" style={{ margin: 0 }}>
          Tiap distributor punya pemetaan kolom sendiri (sudah terisi preset untuk SJA Barabai, Teweh, Buntok, dan Tanjung).
          Cukup upload file progress di atas; gunakan tombol per distributor di bawah bila format filenya berubah.
          Data disimpan di perangkat ini dan, setelah masuk dengan password (ikon ☁ di kanan atas), tersinkron ke semua perangkat.
        </p>
      </div>
      {data.configs.map((c, i) => (
        <DistributorSetup
          key={c.id}
          cfg={c}
          color={SERIES[i]}
          rows={data.rows[c.id] ?? []}
          stats={prepared[c.id]?.stats}
          actions={actions}
          pendingFile={pending?.id === c.id ? pending.file : undefined}
          onPendingDone={onPendingDone}
        />
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
  mapping: Mapping
  omsetMode: DistributorConfig['omsetMode']
  itemSource?: ItemSource
}

function DistributorSetup({ cfg, color, rows, stats, actions, pendingFile, onPendingDone }: {
  cfg: DistributorConfig
  color: string
  rows: SaleRow[]
  stats?: EnrichStats
  actions: AppActions
  pendingFile?: File
  onPendingDone: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
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
      const { buf, sheets } = await readFile(f)
      const saved = findSheet(sheets, cfg.sheet)
      const sheet = saved ?? rankSheets(sheets)[0]
      const headerRow = saved ? (cfg.headerRow ?? 0) : sheet.headerRow
      const hs = headersAt(sheet, headerRow)
      // Pertahankan pemetaan tersimpan untuk kolom yang masih ada; sisanya ditebak.
      const kept: Mapping = Object.fromEntries(Object.entries(cfg.mapping).filter(([, h]) => h && hs.includes(h)))
      const itemSheet = cfg.itemSource ? findSheet(sheets, cfg.itemSource.sheet) : undefined
      setDraft({
        buf,
        fileName: f.name,
        sheets,
        sheet: sheet.name,
        headerRow,
        mapping: { ...guessMapping(hs), ...kept },
        omsetMode: cfg.omsetMode,
        itemSource: cfg.itemSource && itemSheet ? { ...cfg.itemSource, sheet: itemSheet.name } : cfg.itemSource,
      })
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    if (!pendingFile) return
    // File dari uploader otomatis yang perlu dipetakan manual.
    void Promise.resolve().then(() => onFile(pendingFile))
    onPendingDone()
  }, [pendingFile]) // eslint-disable-line react-hooks/exhaustive-deps

  const sheetInfo = draft ? draft.sheets.find((s) => s.name === draft.sheet) : undefined
  const headers = sheetInfo && draft ? headersAt(sheetInfo, draft.headerRow) : []
  const preview = sheetInfo && draft ? sheetInfo.top.slice(draft.headerRow + 1, draft.headerRow + 6) : []
  const missing = draft ? missingFields(draft.mapping, draft.omsetMode) : []

  const pickSheet = (name: string) => {
    const s = draft!.sheets.find((x) => x.name === name)!
    setDraft({ ...draft!, sheet: name, headerRow: s.headerRow, mapping: guessMapping(s.headers) })
  }
  const setHeaderRow = (n: number) => {
    const hr = Math.max(0, Math.min(n, sheetInfo!.top.length - 2))
    setDraft({ ...draft!, headerRow: hr, mapping: guessMapping(headersAt(sheetInfo!, hr)) })
  }

  const process = async () => {
    if (!draft) return
    setBusy('Memproses data…')
    setMsg(null)
    try {
      const next: DistributorConfig = {
        ...cfg,
        sheet: draft.sheet.trim(),
        headerRow: draft.headerRow,
        mapping: draft.mapping,
        omsetMode: draft.omsetMode,
        itemSource: draft.itemSource?.sheet && draft.itemSource.key ? draft.itemSource : undefined,
      }
      const res = await ingest(draft.buf, draft.fileName, draft.sheets, next)
      await actions.applyIngest(res)
      const p = res.parse
      setMsg({
        kind: 'ok',
        text: `${num(res.rows.length)} baris tersimpan (${p.minDate ? dateLabel(p.minDate) : ''} – ${p.maxDate ? dateLabel(p.maxDate) : ''})` +
          (p.skipped ? `, ${num(p.skipped)} baris dilewati (tanggal/customer kosong)` : '') +
          (res.newItems ? `, ${res.newItems} barang baru masuk master` : '') +
          (p.itemError ? `. Master barang gagal dibaca: ${p.itemError}` : '') + '.',
      })
      setDraft(null)
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(null)
    }
  }

  const clear = async () => {
    if (!confirm(`Hapus semua data transaksi ${cfg.nama}? Pemetaan, master barang & target tetap disimpan.`)) return
    await deleteRows(cfg.id)
    await actions.replaceRows(cfg.id, [])
    actions.updateConfig({ ...cfg, rowCount: 0, fileName: undefined, updatedAt: undefined })
  }

  return (
    <div className="card stack" style={{ gap: 12 }} ref={cardRef}>
      <div className="row">
        <span className="swatch" style={{ background: color, width: 14, height: 14 }} />
        <input value={cfg.nama} onChange={(e) => actions.updateConfig({ ...cfg, nama: e.target.value })} style={{ fontWeight: 600, width: 200 }} aria-label="Nama distributor" />
        <label className="row small text-2" style={{ gap: 6 }} title="Kata di nama file untuk mengenali distributor ini">
          Kata kunci file
          <input value={cfg.fileHint ?? ''} onChange={(e) => actions.updateConfig({ ...cfg, fileHint: e.target.value })} style={{ width: 110 }} />
        </label>
        <span className="small text-2" style={{ flex: 1, minWidth: 200 }}>
          {rows.length ? `${num(rows.length)} baris · ${range} · ${cfg.fileName ?? ''}` : 'Belum ada data'}
          {cfg.updatedAt && ` · diupdate ${new Date(cfg.updatedAt).toLocaleString('id-ID')}`}
        </span>
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={!!busy}>Upload &amp; atur pemetaan</button>
        {rows.length > 0 && <button className="btn danger" onClick={clear}>Hapus data</button>}
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls,.csv" hidden onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.target.value = '' }} />
      </div>
      <div className="small muted">
        Sheet <b>{cfg.sheet ?? '–'}</b> · header baris {(cfg.headerRow ?? 0) + 1} ·{' '}
        {cfg.omsetMode === 'master' ? 'omset = qty × harga NFI dari master barang' : `omset dari kolom "${cfg.mapping.omset ?? '–'}"`}
        {cfg.itemSource && ` · master barang dari sheet "${cfg.itemSource.sheet}"`}
        {cfg.mapping.jenis && ` · jenis transaksi dari "${cfg.mapping.jenis}"`}
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
              <input type="number" min={1} max={sheetInfo.top.length - 1} value={draft.headerRow + 1} style={{ width: 80 }} onChange={(e) => setHeaderRow((+e.target.value || 1) - 1)} />
            </label>
            <label className="field">
              Omset dihitung dari
              <select value={draft.omsetMode} onChange={(e) => setDraft({ ...draft, omsetMode: e.target.value as Draft['omsetMode'] })}>
                <option value="kolom">Kolom omset di file</option>
                <option value="master">Qty × harga NFI (master barang)</option>
              </select>
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Kolom dashboard</th><th>Header di Excel</th><th>Contoh nilai</th><th>Fungsi</th></tr></thead>
              <tbody>
                {FIELDS.map((f) => {
                  const h = draft.mapping[f.key]
                  const idx = h ? headers.indexOf(h) : -1
                  const sample = idx >= 0
                    ? preview.map((r) => r[idx]).filter((v) => v != null && v !== '').slice(0, 3)
                        .map((v) => (f.key === 'tanggal' ? (parseDate(v) ? dateLabel(parseDate(v)!) : `${v} (tidak terbaca)`) : String(v))).join(' · ')
                    : ''
                  return (
                    <tr key={f.key}>
                      <td>{f.label}</td>
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

          <ItemSourceEditor draft={draft} onChange={(itemSource) => setDraft({ ...draft, itemSource })} />

          <div className="row">
            <button className="btn primary" disabled={!!busy || missing.length > 0} onClick={process}>Proses &amp; simpan</button>
            <button className="btn" onClick={() => setDraft(null)}>Batal</button>
            {missing.length > 0 && <span className="small" style={{ color: 'var(--critical-text)' }}>Wajib dipetakan: {missing.join(', ')}</span>}
          </div>
        </div>
      )}

      {rows.length > 0 && !draft && <Rules cfg={cfg} rows={rows} stats={stats} actions={actions} />}
    </div>
  )
}

// Sumber master barang: sheet lain di file yang sama (mis. "DATA RAPI" / "Mapping Item").
function ItemSourceEditor({ draft, onChange }: { draft: Draft; onChange: (s: ItemSource | undefined) => void }) {
  const src = draft.itemSource
  const sheet = src ? findSheet(draft.sheets, src.sheet) : undefined
  const hs = sheet ? headersAt(sheet, src!.headerRow) : []
  const set = (patch: Partial<ItemSource>) => onChange({ ...(src ?? { sheet: '', headerRow: 0, key: '' }), ...patch })
  const col = (label: string, k: keyof ItemSource) => (
    <label className="field" key={k}>
      {label}
      <select value={(src?.[k] as string) ?? ''} onChange={(e) => set({ [k]: e.target.value || undefined })}>
        <option value="">— tidak ada —</option>
        {hs.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </label>
  )
  return (
    <div className="subpanel">
      <h3 style={{ marginBottom: 4 }}>Master barang dari sheet lain (opsional)</h3>
      <p className="small muted" style={{ marginTop: 0 }}>
        Untuk file yang tidak punya kolom brand/channel/harga NFI. Dibaca ulang setiap upload, hasilnya disimpan & bisa diedit.
      </p>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field">
          Sheet
          <select value={sheet?.name ?? ''} onChange={(e) => {
            if (!e.target.value) return onChange(undefined)
            const s = draft.sheets.find((x) => x.name === e.target.value)!
            onChange({ sheet: s.name, headerRow: s.headerRow, key: '' })
          }}>
            <option value="">— tidak dipakai —</option>
            {draft.sheets.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </label>
        {sheet && (
          <>
            <label className="field">
              Header baris ke-
              <input type="number" min={1} value={src!.headerRow + 1} style={{ width: 70 }} onChange={(e) => set({ headerRow: Math.max(0, (+e.target.value || 1) - 1) })} />
            </label>
            {col('Kode barang *', 'key')}
            {col('Nama', 'nama')}
            {col('Brand', 'brand')}
            {col('Channel (POLOS/NON POLOS)', 'channel')}
            {col('Harga NFI / satuan', 'harga')}
          </>
        )}
      </div>
    </div>
  )
}

type Tab = 'jenis' | 'channel' | 'brand' | 'salesman' | 'items'

function Rules({ cfg, rows, stats, actions }: { cfg: DistributorConfig; rows: SaleRow[]; stats?: EnrichStats; actions: AppActions }) {
  const [tab, setTab] = useState<Tab | null>(stats?.unpriced.length ? 'items' : null)
  const groups = useMemo(() => {
    const agg = (key: (r: SaleRow) => string) => {
      const m = new Map<string, { n: number; om: number }>()
      for (const r of rows) {
        const k = key(r)
        const a = m.get(k) ?? { n: 0, om: 0 }
        a.n++
        a.om += cfg.omsetMode === 'master' ? r.q * (cfg.items[r.k]?.harga ?? 0) : r.om
        m.set(k, a)
      }
      return [...m.entries()].sort((x, y) => y[1].n - x[1].n)
    }
    return {
      jenis: agg((r) => r.tx),
      channel: agg((r) => rawChannel(cfg, r)),
      brand: agg((r) => rawBrand(cfg, r)),
      salesman: agg((r) => r.s),
    }
  }, [rows, cfg])

  const tabs: [Tab, string][] = [
    ...(cfg.mapping.jenis ? [['jenis', 'Jenis transaksi'] as [Tab, string]] : []),
    ['channel', 'GT / MT'],
    ['brand', 'Grup brand'],
    ['salesman', 'Nama salesman'],
    ['items', `Master barang (${Object.keys(cfg.items).length})`],
  ]

  return (
    <div style={{ borderTop: '1px solid var(--grid)', paddingTop: 12 }}>
      <div className="row" style={{ gap: 6 }}>
        <span className="small text-2">Aturan data:</span>
        {tabs.map(([k, label]) => (
          <button key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(tab === k ? null : k)}>
            {label}
            {k === 'items' && stats?.unpriced.length ? <span className="status warning"> · {stats.unpriced.length} belum ada harga</span> : null}
          </button>
        ))}
        {stats && stats.excluded > 0 && <span className="small muted">{num(stats.excluded)} baris diabaikan</span>}
      </div>

      {tab === 'jenis' && (
        <ValueTable
          title={`Nilai "${cfg.mapping.jenis}"`}
          rows={groups.jenis}
          render={(v) => (
            <select value={cfg.trxMap[v] ?? guessTrx(v)} onChange={(e) => actions.updateConfig({ ...cfg, trxMap: { ...cfg.trxMap, [v]: e.target.value as TrxKind } })}>
              <option value="IN">Hitung sebagai penjualan</option>
              <option value="X">Abaikan</option>
            </select>
          )}
          note="Retur bernilai negatif; pilih 'Hitung' bila omset ingin dikurangi retur."
        />
      )}
      {tab === 'channel' && (
        cfg.mapping.kategori || Object.values(cfg.items).some((i) => i.channel) ? (
          <ValueTable
            title="Nilai kategori / channel"
            rows={groups.channel}
            render={(v) => (
              <select value={cfg.channelMap[v] ?? guessChannel(v)} onChange={(e) => actions.updateConfig({ ...cfg, channelMap: { ...cfg.channelMap, [v]: e.target.value as Channel } })}>
                <option value="GT">GT (Traditional)</option>
                <option value="MT">MT (Modern)</option>
                <option value="X">Abaikan</option>
              </select>
            )}
          />
        ) : (
          <label className="field" style={{ marginTop: 10 }}>
            Tidak ada kolom kategori. Semua transaksi dihitung sebagai:
            <select value={cfg.defaultChannel} onChange={(e) => actions.updateConfig({ ...cfg, defaultChannel: e.target.value as Channel })}>
              <option value="GT">GT (Traditional)</option>
              <option value="MT">MT (Modern)</option>
            </select>
          </label>
        )
      )}
      {tab === 'brand' && (
        <ValueTable
          title="Brand di data"
          rows={groups.brand}
          note='Samakan nama brand antar distributor, mis. "HILO TRADITIONAL" → "HI LO". Kosongkan untuk memakai nama asli.'
          render={(v) => (
            <input key={v + (cfg.brandMap[v] ?? '')} defaultValue={cfg.brandMap[v] ?? ''} placeholder={v || 'LAINNYA'}
              onBlur={(e) => actions.updateConfig({ ...cfg, brandMap: { ...cfg.brandMap, [v]: e.target.value.trim() } })} />
          )}
        />
      )}
      {tab === 'salesman' && (
        <ValueTable
          title="Salesman di data"
          rows={groups.salesman}
          note='Gabungkan penulisan berbeda, mis. "YUDA - NUTRIFOOD" → "Yuda Arbaniansyah".'
          render={(v) => (
            <input key={v + (cfg.salesmanMap[v] ?? '')} defaultValue={cfg.salesmanMap[v] ?? ''} placeholder={v}
              onBlur={(e) => actions.updateConfig({ ...cfg, salesmanMap: { ...cfg.salesmanMap, [v]: e.target.value.trim() } })} />
          )}
        />
      )}
      {tab === 'items' && <ItemsEditor cfg={cfg} rows={rows} stats={stats} actions={actions} />}
    </div>
  )
}

function ValueTable({ title, rows, render, note }: {
  title: string
  rows: [string, { n: number; om: number }][]
  render: (v: string) => React.ReactNode
  note?: string
}) {
  return (
    <div style={{ marginTop: 10 }}>
      {note && <p className="small muted" style={{ marginTop: 0 }}>{note}</p>}
      <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
        <table>
          <thead><tr><th>{title}</th><th className="n">Baris</th><th className="n">Omset</th><th>Aturan</th></tr></thead>
          <tbody>
            {rows.map(([v, s]) => (
              <tr key={v}>
                <td>{v || <span className="muted">(kosong)</span>}</td>
                <td className="n">{num(s.n)}</td>
                <td className="n">{rp(s.om)}</td>
                <td>{render(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ItemsEditor({ cfg, rows, stats, actions }: { cfg: DistributorConfig; rows: SaleRow[]; stats?: EnrichStats; actions: AppActions }) {
  const [q, setQ] = useState('')
  // Semua kode barang yang muncul di data + yang ada di master.
  const list = useMemo(() => {
    const names = new Map<string, string>()
    for (const r of rows) if (!names.has(r.k)) names.set(r.k, r.n)
    for (const k of Object.keys(cfg.items)) if (!names.has(k)) names.set(k, '')
    const unpriced = new Set(stats?.unpriced.map((u) => u.k))
    return [...names.entries()]
      .map(([k, n]) => ({ k, n, it: cfg.items[k] ?? {}, missing: unpriced.has(k) }))
      .sort((a, b) => Number(b.missing) - Number(a.missing) || a.k.localeCompare(b.k))
  }, [rows, cfg.items, stats])
  const shown = list.filter((x) => !q || `${x.k} ${x.n} ${x.it.nama ?? ''} ${x.it.brand ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  const setItem = (k: string, patch: Partial<ItemInfo>) =>
    actions.updateConfig({ ...cfg, items: { ...cfg.items, [k]: { ...cfg.items[k], ...patch } } })

  return (
    <div style={{ marginTop: 10 }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <input placeholder="Cari kode / nama barang…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
        <span className="small muted">
          {cfg.omsetMode === 'master' ? 'Omset distributor ini = qty × harga NFI di tabel ini.' : 'Brand & channel di sini menggantikan nilai dari file (opsional).'}
        </span>
      </div>
      <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
        <table>
          <thead><tr><th>Kode</th><th>Nama di file</th><th>Brand</th><th>Channel</th><th className="n">Harga NFI</th></tr></thead>
          <tbody>
            {shown.map(({ k, n, it, missing }) => (
              <tr key={k} className={missing ? 'warn-row' : undefined}>
                <td className="small">{k}</td>
                <td className="small" title={it.nama}>{n || it.nama}</td>
                <td><input key={k + (it.brand ?? '')} defaultValue={it.brand ?? ''} style={{ width: 110 }} onBlur={(e) => e.target.value !== (it.brand ?? '') && setItem(k, { brand: e.target.value.trim() || undefined })} /></td>
                <td>
                  <select value={it.channel ?? ''} onChange={(e) => setItem(k, { channel: e.target.value || undefined })}>
                    <option value="">(dari file)</option>
                    <option value="POLOS">POLOS</option>
                    <option value="NON POLOS">NON POLOS</option>
                  </select>
                </td>
                <td className="n">
                  <input className="num" key={k + (it.harga ?? '')} defaultValue={it.harga ? num(it.harga) : ''} placeholder={missing ? 'isi harga' : ''}
                    onBlur={(e) => { const v = parseNumber(e.target.value); if (v !== (it.harga ?? 0)) setItem(k, { harga: v || undefined }) }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
