// Hari kerja = Senin–Sabtu (sama dengan NETWORKDAYS.INTL(..., "0000001") di Excel).
const pad = (n: number) => String(n).padStart(2, '0')

export const toYmd = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
export const todayYmd = () => toYmd(new Date())
export const monthOf = (ymd: string) => ymd.slice(0, 7)

const fromYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export const isWorkday = (ymd: string) => fromYmd(ymd).getDay() !== 0

// Daftar tanggal hari kerja dalam satu bulan.
export function workdaysOfMonth(month: string): string[] {
  const out: string[] = []
  for (let d = 1; d <= daysInMonth(month); d++) {
    const s = `${month}-${pad(d)}`
    if (isWorkday(s)) out.push(s)
  }
  return out
}

export interface TimeGone {
  total: number // total hari kerja sebulan
  elapsed: number // hari kerja yang sudah lewat s/d hari ini (termasuk hari ini)
  remaining: number // sisa hari kerja setelah hari ini
  ratio: number
}

export function timeGone(month: string, today = todayYmd()): TimeGone {
  const days = workdaysOfMonth(month)
  const elapsed = days.filter((d) => d <= today).length
  const remaining = days.filter((d) => d > today).length
  return { total: days.length, elapsed, remaining, ratio: days.length ? elapsed / days.length : 0 }
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const MONTH_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export const monthLabel = (month: string, full = false) => {
  const [y, m] = month.split('-').map(Number)
  return `${(full ? MONTH_FULL : MONTH_NAMES)[m - 1]} ${y}`
}

export const dateLabel = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const dt = new Date(y, m - 1 + delta, 1)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`
}
