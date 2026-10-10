import { useMemo, useState, type ReactNode } from 'react'

export interface Column<T> {
  key: string
  label: string
  num?: boolean // rata kanan + angka tabular
  render: (row: T) => ReactNode
  sort?: (row: T) => number | string
  wide?: boolean // kolom utama (nama)
  hideSm?: boolean // sembunyikan di layar kecil
}

interface Props<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  search?: (row: T) => string
  searchPlaceholder?: string
  initialSort?: { key: string; dir: 1 | -1 }
  limit?: number
  empty?: string
  toolbar?: ReactNode
  footer?: ReactNode
}

// Tabel serbaguna: klik judul kolom untuk mengurutkan, cari, klik baris untuk melihat detail.
export default function DataTable<T>({
  rows, columns, rowKey, onRowClick, search, searchPlaceholder = 'Cari…', initialSort, limit = 20, empty = 'Tidak ada data', toolbar, footer,
}: Props<T>) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(initialSort)
  const [shown, setShown] = useState(limit)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let out = needle && search ? rows.filter((r) => search(r).toLowerCase().includes(needle)) : rows
    const col = sort && columns.find((c) => c.key === sort.key)
    if (col?.sort) {
      const f = col.sort
      out = [...out].sort((a, b) => {
        const x = f(a)
        const y = f(b)
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort!.dir
      })
    }
    return out
  }, [rows, q, sort, columns, search])

  const clickSort = (c: Column<T>) => {
    if (!c.sort) return
    setSort((s) => (s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: c.num ? -1 : 1 }))
  }

  return (
    <div className="dt">
      {(search || toolbar) && (
        <div className="dt-toolbar">
          {search && (
            <input className="dt-search" type="search" value={q} placeholder={searchPlaceholder} onChange={(e) => { setQ(e.target.value); setShown(limit) }} />
          )}
          {toolbar}
          <span className="muted small dt-count">{list.length.toLocaleString('id-ID')} baris</span>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`${c.num ? 'n' : ''}${c.sort ? ' sortable' : ''}${c.hideSm ? ' hide-sm' : ''}`}
                  onClick={() => clickSort(c)}
                  aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}
                >
                  {c.label}
                  {sort?.key === c.key && <span className="sort-ind">{sort.dir === 1 ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.slice(0, shown).map((r) => (
              <tr key={rowKey(r)} className={onRowClick ? 'clickable' : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={`${c.num ? 'n' : ''}${c.wide ? ' wide' : ''}${c.hideSm ? ' hide-sm' : ''}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
            {!list.length && (
              <tr><td colSpan={columns.length} className="muted" style={{ textAlign: 'center', padding: 20 }}>{empty}</td></tr>
            )}
          </tbody>
          {footer}
        </table>
      </div>
      {list.length > shown && (
        <button className="btn ghost dt-more" onClick={() => setShown((n) => n + 50)}>
          Tampilkan lebih banyak ({(list.length - shown).toLocaleString('id-ID')} lagi)
        </button>
      )}
    </div>
  )
}
