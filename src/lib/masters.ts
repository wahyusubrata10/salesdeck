// Master barang tertanam (disalin dari sheet Kat Tabi / Master Item Regular / Mapping Item di Excel distributor).
// Dipakai agar file data mentah (tanpa kolom Brand/Channel) bisa langsung diolah, seperti rumus VLOOKUP di Excel.
import data from '../data/items.json'
import type { DistributorConfig, ItemInfo } from './types'

type Raw = { n?: string; b?: string; c?: string; h?: number }
const MASTERS = data as Record<string, Record<string, Raw>>

// Master tiap distributor (sheet master miliknya + hasil rumus di database Excel-nya), lalu cadangan
// master gabungan kode Nutrifood untuk barang yang belum dikenal.
const SOURCE: Record<string, string[]> = { d1: ['d1', 'nfi'], d2: ['d2', 'nfi'], d3: ['d3'], d4: ['d4', 'nfi'] }

const toInfo = (r: Raw): ItemInfo => ({ nama: r.n, brand: r.b, channel: r.c, harga: r.h })

export function hasMaster(cfgId: string) {
  return !!SOURCE[cfgId]
}

const patternCache = new Map<string, RegExp>()

export function masterItem(cfg: DistributorConfig, code: string): ItemInfo | undefined {
  if (!code) return undefined
  let alt: string | undefined
  if (cfg.itemKeyPattern) {
    let re = patternCache.get(cfg.itemKeyPattern)
    if (!re) patternCache.set(cfg.itemKeyPattern, (re = new RegExp(cfg.itemKeyPattern)))
    alt = code.match(re)?.[0]
  }
  for (const name of SOURCE[cfg.id] ?? []) {
    const table = MASTERS[name]
    const hit = table?.[code.trim()] ?? (alt ? table?.[alt] : undefined)
    if (hit) return toInfo(hit)
  }
  return undefined
}

// Data barang final: isian manual di website menimpa master bawaan.
export function itemOf(cfg: DistributorConfig, code: string): ItemInfo | undefined {
  const own = cfg.items[code]
  const base = masterItem(cfg, code)
  if (!own) return base
  if (!base) return own
  return { ...base, ...Object.fromEntries(Object.entries(own).filter(([, v]) => v !== undefined && v !== '')) }
}
