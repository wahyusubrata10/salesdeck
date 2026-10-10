// Target bawaan, disalin dari sheet DASHBOARD / TARGET di file Excel masing-masing distributor.
// Hanya mengisi bulan yang belum punya target (tidak menimpa isian di website).
import type { MonthTarget, Targets } from './types'

type BrandRow = [brand: string, omset: number, ea: number]

function target(
  gt: [omset: number, ea: number],
  mt: [omset: number, ea: number],
  ecHk: number,
  brandsGT: BrandRow[],
  brandsMT: BrandRow[],
): MonthTarget {
  const brand: MonthTarget['brand'] = {}
  for (const [b, omset, ea] of brandsGT) brand[`GT|${b}`] = { omset, ea }
  for (const [b, omset, ea] of brandsMT) brand[`MT|${b}`] = { omset, ea }
  return {
    GT: { omset: gt[0], ea: gt[1] },
    MT: { omset: mt[0], ea: mt[1] },
    ecHk,
    asrt: 14, // SKU / EA GT
    asrtBrand: { NUTRISARI: 10, 'HI LO': 7 }, // SKU / EA NS GT & HILO GT
    brand,
  }
}

// Tanjung: target Juli–September sama (sheet TARGET), pembagian brand dari DASHBOARD NEW.
const tanjung = target(
  [175_000_000, 270], [150_000_000, 132], 30,
  [['NUTRISARI', 108_905_815, 250], ['HI LO', 53_897_321, 188], ['TS', 12_196_864, 84]],
  [['HI LO', 64_757_126, 66], ['TS', 72_095_635, 92], ['NUTRISARI', 4_107_763, 57], ['L-MEN', 9_039_475, 11]],
)

export const PRESET_TARGETS: Targets = {
  // SJA Barabai — sheet Dashboard (data Juli 2026)
  d1: {
    '2026-07': target(
      [350_000_000, 625], [160_000_000, 200], 36,
      [['NUTRISARI', 169_054_538, 489], ['HI LO', 140_724_708, 339], ['TS', 40_220_754, 255]],
      [['HI LO', 80_803_914, 142], ['TS', 72_609_311, 128], ['NUTRISARI', 892_403, 15], ['L-MEN', 5_694_371, 16]],
    ),
  },
  // Teweh — sheet DASHBOARD (September 2026)
  d2: {
    '2026-09': target(
      [70_000_000, 120], [85_000_000, 70], 15,
      [['NUTRISARI', 38_500_000, 105], ['HI LO', 34_300_000, 95], ['TS', 700_000, 10]],
      [['HI LO', 35_700_000, 65], ['TS', 35_700_000, 60], ['NUTRISARI', 2_550_000, 10], ['L-MEN', 2_550_000, 15]],
    ),
  },
  // Buntok — sheet DASHBOARD (September 2026)
  d3: {
    '2026-09': target(
      [50_000_000, 55], [45_000_000, 15], 15,
      [['NUTRISARI', 27_500_000, 40], ['HI LO', 20_000_000, 25], ['TS', 2_500_000, 5]],
      [['HI LO', 18_900_000, 12], ['TS', 18_900_000, 12], ['NUTRISARI', 1_350_000, 15], ['L-MEN', 1_350_000, 1]],
    ),
  },
  d4: { '2026-07': tanjung, '2026-08': tanjung, '2026-09': tanjung },
}

// Lengkapi target yang belum ada dengan preset. null = tidak ada yang perlu ditambah.
export function seedTargets(current: Targets): Targets | null {
  let changed = false
  const next: Targets = { ...current }
  for (const [id, months] of Object.entries(PRESET_TARGETS)) {
    for (const [m, t] of Object.entries(months)) {
      if (next[id]?.[m]) continue
      next[id] = { ...next[id], [m]: structuredClone(t) }
      changed = true
    }
  }
  return changed ? next : null
}
