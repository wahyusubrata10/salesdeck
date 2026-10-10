import { del, get, set } from 'idb-keyval'
import { PRESETS, upgradeConfig } from './presets'
import { markChanged, rowsKey } from './sync'
import type { DistributorConfig, SaleRow, Targets } from './types'

// Data disimpan lokal di IndexedDB; perubahan ditandai untuk dikirim ke cloud oleh sync.ts.
const K_CONFIGS = 'salesdeck:configs'
const K_TARGETS = 'salesdeck:targets'
const kRows = (id: string) => `salesdeck:rows:${id}`

export const defaultConfigs = (): DistributorConfig[] => structuredClone(PRESETS)

export async function loadAll() {
  const stored = await get<DistributorConfig[]>(K_CONFIGS)
  const configs = stored ? stored.map(upgradeConfig) : defaultConfigs()
  const targets = (await get<Targets>(K_TARGETS)) ?? {}
  const rows: Record<string, SaleRow[]> = {}
  for (const c of configs) rows[c.id] = ((await get<SaleRow[]>(kRows(c.id))) ?? []).map((r) => ({ ...r, tx: r.tx ?? '' }))
  return { configs, targets, rows }
}

// Setiap penyimpanan lokal juga ditandai untuk dikirim ke cloud (bila sinkronisasi aktif).
export const saveConfigs = (c: DistributorConfig[]) => set(K_CONFIGS, c).then(() => markChanged('configs'))
export const saveTargets = (t: Targets) => set(K_TARGETS, t).then(() => markChanged('targets'))
export const saveRows = (id: string, rows: SaleRow[]) => set(kRows(id), rows).then(() => markChanged(rowsKey(id)))
export const deleteRows = (id: string) => del(kRows(id)).then(() => markChanged(rowsKey(id)))

// Kunci sinkron yang punya data lokal (untuk pertama kali sinkron).
export async function localSyncKeys(): Promise<string[]> {
  const out: string[] = []
  if (await get(K_CONFIGS)) out.push('configs')
  if (await get(K_TARGETS)) out.push('targets')
  for (const p of PRESETS) if ((await get<SaleRow[]>(kRows(p.id)))?.length) out.push(rowsKey(p.id))
  return out
}

// Cadangan pengaturan (pemetaan header + target), tanpa data transaksi.
export interface Backup {
  version: 1
  configs: DistributorConfig[]
  targets: Targets
}
