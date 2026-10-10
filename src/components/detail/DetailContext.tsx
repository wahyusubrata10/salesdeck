import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Prepared } from '../../App'
import type { DistributorConfig, Targets } from '../../lib/types'
import { DetailCtx, type DetailRef } from './context'

// Komponen panel detail diisi lewat prop agar file ini hanya mengekspor komponen & hook.
export function DetailProvider({ children, configs, prepared, targets, month, render }: {
  children: ReactNode
  configs: DistributorConfig[]
  prepared: Prepared
  targets: Targets
  month: string
  render: (ref: DetailRef, month: string, setMonth: (m: string) => void) => ReactNode
}) {
  const [stack, setStack] = useState<DetailRef[]>([])
  const [dMonth, setDMonth] = useState(month)
  const open = useCallback((ref: DetailRef) => {
    setStack((s) => {
      if (!s.length) setDMonth(month)
      return [...s, ref]
    })
  }, [month])
  const close = () => setStack([])
  const back = () => setStack((s) => s.slice(0, -1))
  const top = stack[stack.length - 1]

  useEffect(() => {
    if (!top) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setStack([])
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [top])

  const value = useMemo(() => ({ open, configs, prepared, targets, month }), [open, configs, prepared, targets, month])

  return (
    <DetailCtx.Provider value={value}>
      {children}
      {top && (
        <div className="drawer-backdrop" onClick={close}>
          <aside className="drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-nav">
              {stack.length > 1 ? (
                <button className="btn ghost" onClick={back}>‹ Kembali</button>
              ) : <span />}
              <button className="btn ghost icon" onClick={close} aria-label="Tutup">✕</button>
            </div>
            <div className="drawer-body" key={stack.length}>
              {render(top, dMonth, setDMonth)}
            </div>
          </aside>
        </div>
      )}
    </DetailCtx.Provider>
  )
}
