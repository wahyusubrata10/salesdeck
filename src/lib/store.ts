import { del, get, set } from 'idb-keyval'
import type { DistributorConfig, SaleRow, Targets } from './types'

// Semua data disimpan di IndexedDB browser ini — tidak dikirim ke server mana pun.
const K_CONFIGS = 'salesdeck:configs'
const K_TARGETS = 'salesdeck:targets'
const kRows = (id: string) => `salesdeck:rows:${id}`

export const DISTRIBUTOR_COUNT = 4

export const defaultConfigs = (): DistributorConfig[] =>
  Array.from({ length: DISTRIBUTOR_COUNT }, (_, i) => ({
    id: `d${i + 1}`,
    nama: `Distributor ${i + 1}`,
    mapping: {},
    channelMap: {},
    defaultChannel: 'GT',
    brandMap: {},
  }))

export async function loadAll() {
  const configs = (await get<DistributorConfig[]>(K_CONFIGS)) ?? defaultConfigs()
  const targets = (await get<Targets>(K_TARGETS)) ?? {}
  const rows: Record<string, SaleRow[]> = {}
  for (const c of configs) rows[c.id] = (await get<SaleRow[]>(kRows(c.id))) ?? []
  return { configs, targets, rows }
}

export const saveConfigs = (c: DistributorConfig[]) => set(K_CONFIGS, c)
export const saveTargets = (t: Targets) => set(K_TARGETS, t)
export const saveRows = (id: string, rows: SaleRow[]) => set(kRows(id), rows)
export const deleteRows = (id: string) => del(kRows(id))

// Cadangan pengaturan (pemetaan header + target), tanpa data transaksi.
export interface Backup {
  version: 1
  configs: DistributorConfig[]
  targets: Targets
}
