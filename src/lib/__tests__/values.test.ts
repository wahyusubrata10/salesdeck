import { describe, expect, it } from 'vitest'
import { customerKey } from '../parseCore'
import { parseDate, parseNumber } from '../values'

describe('parseNumber', () => {
  it.each([
    [1234.5, 1234.5],
    ['Rp 1.234.567', 1234567],
    ['1.234.567,50', 1234567.5],
    ['1,234,567.50', 1234567.5],
    ['12,5', 12.5],
    ['1.500', 1500],
    ['(2.000)', -2000],
    ['', 0],
    [null, 0],
  ])('%s -> %s', (input, out) => expect(parseNumber(input)).toBe(out))
})

describe('parseDate', () => {
  it.each([
    [46024, '2026-01-02'], // serial Excel
    ['2026-07-31', '2026-07-31'],
    ['31/07/2026', '2026-07-31'],
    ['2-1-26', '2026-01-02'],
    ['5 Agu 2026', '2026-08-05'],
    ['27-Aug-26', '2026-08-27'],
    ['02-Jan-26', '2026-01-02'],
    ['2026-09-19 00:00:00', '2026-09-19'],
    ['bukan tanggal', null],
    [12, null],
  ])('%s -> %s', (input, out) => expect(parseDate(input)).toBe(out))
})

describe('customerKey', () => {
  it('nama tanpa spasi/tanda baca, huruf kecil', () => {
    expect(customerKey('B7 DS LINA')).toBe('b7dslina')
    expect(customerKey(' B7  DS LINA ')).toBe('b7dslina')
    expect(customerKey('B7 DS MELATI / ALFI')).toBe('b7dsmelatialfi')
  })
})
