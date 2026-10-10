const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

const validDate = (y: number, m: number, d: number) =>
  y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
}

// Mengubah nilai sel (serial Excel, Date, atau teks) menjadi 'YYYY-MM-DD'.
export function parseDate(v: unknown): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return null // di luar rentang ~1954-2119
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000)
    return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
  }
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null
    return ymd(v.getFullYear(), v.getMonth() + 1, v.getDate())
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]]
    return validDate(y, mo, d) ? ymd(y, mo, d) : null
  }
  // Format Indonesia: hari/bulan/tahun
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    let y = +m[3]
    if (y < 100) y += 2000
    const [d, mo] = [+m[1], +m[2]]
    return validDate(y, mo, d) ? ymd(y, mo, d) : null
  }
  // "02-Jan-26", "5 Agustus 2026"
  m = s.match(/^(\d{1,2})[\s-]+([a-z]{3})[a-z]*[\s-]+(\d{2}|\d{4})\b/i)
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()]
    const d = +m[1]
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    return mo && validDate(y, mo, d) ? ymd(y, mo, d) : null
  }
  return null
}

// Mengubah angka (termasuk teks "Rp 1.234.567,50" atau "1,234,567.50").
export function parseNumber(v: unknown): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0
  if (v == null) return 0
  let s = String(v).replace(/rp/gi, '').replace(/\s/g, '')
  if (!s) return 0
  let neg = false
  if (/^\(.*\)$/.test(s)) {
    neg = true
    s = s.slice(1, -1)
  }
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    // Pemisah yang muncul terakhir adalah desimal.
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (lastComma >= 0) {
    const parts = s.split(',')
    s = parts.length === 2 && parts[1].length !== 3 ? s.replace(',', '.') : s.replace(/,/g, '')
  } else if (lastDot >= 0) {
    const parts = s.split('.')
    if (parts.length > 2 || parts[1].length === 3) s = s.replace(/\./g, '')
  }
  const n = parseFloat(s)
  if (!isFinite(n)) return 0
  return neg ? -n : n
}

export const str = (v: unknown) => (v == null ? '' : String(v).trim())
