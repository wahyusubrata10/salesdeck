const id = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
const id1 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const rp = (n: number) => `Rp ${id.format(Math.round(n))}`
export const num = (n: number) => id.format(Math.round(n))
export const dec = (n: number) => id1.format(n)
export const pct = (n: number | null | undefined) => (n == null || !isFinite(n) ? '–' : `${id1.format(n * 100)}%`)

// Ringkas: 457,5 jt / 1,2 M
export function rpShort(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9) return `${id1.format(n / 1e9)} M`
  if (a >= 1e6) return `${id1.format(n / 1e6)} jt`
  if (a >= 1e3) return `${id.format(n / 1e3)} rb`
  return id.format(n)
}

export const ratio = (a: number, b: number) => (b > 0 ? a / b : null)
