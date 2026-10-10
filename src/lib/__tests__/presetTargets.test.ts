import { describe, expect, it } from 'vitest'
import { PRESET_TARGETS, seedTargets } from '../presetTargets'
import { emptyTarget } from '../types'

describe('target bawaan dari Excel', () => {
  it('total target = Dashboard Excel', () => {
    const tot = (id: string, m: string) => PRESET_TARGETS[id][m].GT.omset + PRESET_TARGETS[id][m].MT.omset
    expect(tot('d1', '2026-07')).toBe(510_000_000)
    expect(tot('d2', '2026-09')).toBe(155_000_000)
    expect(tot('d3', '2026-09')).toBe(95_000_000)
    expect(tot('d4', '2026-09')).toBe(325_000_000)
  })
  it('hanya mengisi bulan yang kosong, tidak menimpa isian', () => {
    const mine = { ...emptyTarget(), GT: { omset: 1, ea: 1 } }
    const next = seedTargets({ d2: { '2026-09': mine } })!
    expect(next.d2['2026-09']).toBe(mine)
    expect(next.d4['2026-08'].GT.omset).toBe(175_000_000)
    expect(seedTargets(next)).toBeNull()
  })
})
