import { useState, type ReactNode } from 'react'
import { statusOf } from '../lib/colors'
import { num, pct } from '../lib/format'
import { parseNumber } from '../lib/values'

export function StatusBadge({ gap }: { gap: number | null }) {
  const s = statusOf(gap)
  if (!s) return <span className="muted small">Target belum diisi</span>
  const icon = s.cls === 'good' ? '✓' : s.cls === 'warning' ? '!' : '✕'
  return (
    <span className={`status ${s.cls}`} title={`GAP vs Time Gone: ${pct(gap)}`}>
      <span className="dot" aria-hidden />
      {icon} {s.label}
    </span>
  )
}

export function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub != null && <div className="sub">{sub}</div>}
    </div>
  )
}

// Bar pencapaian dengan penanda Time Gone.
export function AchBar({ ach, tg }: { ach: number | null; tg: number }) {
  const w = Math.max(0, Math.min(1, ach ?? 0)) * 100
  return (
    <div className="bar" title={`Ach ${pct(ach)} · Time Gone ${pct(tg)}`}>
      <div className="fill" style={{ width: `${w}%` }} />
      <div className="tg" style={{ left: `calc(${Math.min(1, tg) * 100}% - 1px)` }} />
    </div>
  )
}

// Input angka: tampil dengan pemisah ribuan, diproses saat kehilangan fokus.
export function NumInput({ value, onChange, small, decimals }: { value: number; onChange: (v: number) => void; small?: boolean; decimals?: boolean }) {
  const show = (v: number) => (v ? (decimals ? String(v).replace('.', ',') : num(v)) : '')
  const [text, setText] = useState<string | null>(null) // null = tidak sedang diedit
  return (
    <input
      className={`num${small ? ' sm' : ''}`}
      inputMode="decimal"
      value={text ?? show(value)}
      placeholder="0"
      onFocus={() => setText(show(value))}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text == null) return
        onChange(decimals ? parseFloat(text.replace(',', '.')) || 0 : parseNumber(text))
        setText(null)
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

interface TipPayload {
  name?: string
  value?: number | string | null
  color?: string
  dataKey?: string | number
}

export function ChartTip({
  active, payload, label, fmt, labelFmt,
}: {
  active?: boolean
  payload?: TipPayload[]
  label?: string | number
  fmt: (v: number) => string
  labelFmt?: (l: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      <div className="t">{labelFmt ? labelFmt(String(label)) : label}</div>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div className="r" key={String(p.dataKey)}>
            <span className="row" style={{ gap: 6 }}>
              <span className="swatch" style={{ background: p.color }} />
              {p.name}
            </span>
            <span>{fmt(Number(p.value))}</span>
          </div>
        ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; kind?: 'box' | 'line' | 'dash' }[] }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.label}>
          {i.kind === 'dash' ? (
            <i className="dash" />
          ) : i.kind === 'line' ? (
            <i className="line" style={{ background: i.color }} />
          ) : (
            <i className="swatch" style={{ background: i.color }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  )
}
