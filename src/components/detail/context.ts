import { createContext, useContext } from 'react'
import type { Prepared } from '../../App'
import type { DistributorConfig, Targets } from '../../lib/types'

export type DetailKind = 'toko' | 'produk' | 'salesman' | 'brand' | 'hari' | 'faktur' | 'area'

export interface DetailRef {
  kind: DetailKind
  dist: string
  id: string
  title?: string
}

export interface Ctx {
  open: (ref: DetailRef) => void
  configs: DistributorConfig[]
  prepared: Prepared
  targets: Targets
  month: string
}

export const DetailCtx = createContext<Ctx | null>(null)

export function useDetail() {
  const c = useContext(DetailCtx)
  if (!c) throw new Error('useDetail di luar DetailProvider')
  return c
}
