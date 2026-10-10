export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)']
export const CH_COLOR = { GT: 'var(--series-1)', MT: 'var(--series-2)' } as const

// Status berdasarkan GAP %Ach terhadap Time Gone.
export function statusOf(gap: number | null): { cls: 'good' | 'warning' | 'critical'; label: string } | null {
  if (gap == null) return null
  if (gap >= 0) return { cls: 'good', label: 'On track' }
  if (gap >= -0.1) return { cls: 'warning', label: 'Sedikit tertinggal' }
  return { cls: 'critical', label: 'Tertinggal' }
}
