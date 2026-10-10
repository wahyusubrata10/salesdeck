// Sinkronisasi data antar perangkat lewat API Cloudflare (lihat server/api.ts).
// Data tetap disimpan lokal (IndexedDB) dulu agar cepat & bisa offline, lalu dikirim ke cloud.
// Konflik: versi dengan waktu perubahan terbaru yang menang (per kunci: configs, targets, rows-d1..d4).
import { get, set } from 'idb-keyval'

export type SyncStatus = 'checking' | 'unavailable' | 'login' | 'syncing' | 'ok' | 'offline' | 'error'

export interface SyncState {
  status: SyncStatus
  lastSync?: number
  message?: string
  pending: number // jumlah perubahan yang belum terkirim
}

type LocalMeta = Record<string, { updatedAt: number; dirty: boolean }>
type RemoteMeta = Record<string, { updatedAt: number; size: number }>

// Kunci sinkron -> kunci IndexedDB
export const idbKey = (key: string) =>
  key === 'configs' ? 'salesdeck:configs' : key === 'targets' ? 'salesdeck:targets' : `salesdeck:rows:${key.slice(5)}`
export const rowsKey = (id: string) => `rows-${id}`

const K_META = 'salesdeck:sync-meta'
const K_PASS = 'salesdeck:password'

let state: SyncState = { status: 'checking', pending: 0 }
const stateListeners = new Set<(s: SyncState) => void>()
const remoteListeners = new Set<(keys: string[]) => void>()
let meta: LocalMeta = {}
let queue: Promise<unknown> = Promise.resolve()
let pushTimer: ReturnType<typeof setTimeout> | undefined
let lastPull = 0

const setState = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch, pending: Object.values(meta).filter((m) => m.dirty).length }
  stateListeners.forEach((f) => f(state))
}

const password = () => {
  try {
    return localStorage.getItem(K_PASS) ?? ''
  } catch {
    return ''
  }
}

// Semua operasi jaringan dijalankan berurutan.
const serial = <T>(task: () => Promise<T>): Promise<T> => {
  const p = queue.then(task, task)
  queue = p.catch(() => undefined)
  return p
}

async function api(path: string, init: RequestInit = {}, pass = password()) {
  return fetch(new URL(`api/${path}`, document.baseURI), {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${pass}` },
    cache: 'no-store',
  })
}

export async function gzipJson(value: unknown): Promise<ArrayBuffer> {
  const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Response(stream).arrayBuffer()
}

export async function gunzipJson<T>(buf: ArrayBuffer): Promise<T> {
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(stream).text()) as T
}

const saveMeta = () => set(K_META, meta)

// Respons JSON dari API kita? (Hosting statis biasa membalas HTML/404.)
const isApi = (r: Response) => (r.headers.get('content-type') ?? '').includes('application/json')

async function pull(): Promise<string[]> {
  const res = await api('meta')
  if (res.status === 401) {
    setState({ status: 'login', message: 'Password berubah atau salah' })
    return []
  }
  if (!res.ok) throw new Error(`Gagal mengambil data (${res.status})`)
  const remote = (await res.json()) as RemoteMeta
  const changed: string[] = []
  for (const [key, r] of Object.entries(remote)) {
    const local = meta[key]
    if (local && local.updatedAt >= r.updatedAt) continue // lokal sama/lebih baru
    const body = await api(`data/${key}`)
    if (!body.ok) continue
    await set(idbKey(key), await gunzipJson(await body.arrayBuffer()))
    meta[key] = { updatedAt: r.updatedAt, dirty: false }
    changed.push(key)
  }
  await saveMeta()
  lastPull = Date.now()
  return changed
}

async function push() {
  for (const [key, m] of Object.entries(meta)) {
    if (!m.dirty) continue
    const value = await get(idbKey(key))
    const res = await api(`data/${key}`, {
      method: 'PUT',
      body: await gzipJson(value ?? null),
      headers: { 'content-type': 'application/octet-stream', 'x-updated-at': String(m.updatedAt) },
    })
    if (res.status === 401) {
      setState({ status: 'login', message: 'Password berubah atau salah' })
      return
    }
    if (!res.ok) throw new Error(`Gagal menyimpan ${key} (${res.status})`)
    // Hanya tandai bersih bila tidak ada perubahan baru selama pengiriman.
    if (meta[key].updatedAt === m.updatedAt) meta[key] = { ...m, dirty: false }
    await saveMeta()
  }
}

export function syncNow(force = false) {
  if (state.status === 'unavailable' || state.status === 'login' || state.status === 'checking') return Promise.resolve()
  if (!force && Date.now() - lastPull < 10_000 && !state.pending) return Promise.resolve()
  return serial(async () => {
    setState({ status: 'syncing', message: undefined })
    try {
      // pull/push bisa mengubah status ke 'login' bila password tidak lagi valid.
      const needLogin = () => getSyncState().status === 'login'
      const changed = await pull()
      if (needLogin()) return
      await push()
      if (needLogin()) return
      setState({ status: 'ok', lastSync: Date.now() })
      if (changed.length) remoteListeners.forEach((f) => f(changed))
    } catch (e) {
      setState({ status: navigator.onLine ? 'error' : 'offline', message: e instanceof Error ? e.message : String(e) })
    }
  })
}

// Dipanggil setiap data lokal berubah.
export function markChanged(key: string) {
  meta[key] = { updatedAt: Date.now(), dirty: true }
  saveMeta()
  setState({})
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => syncNow(true), 1500)
}

export async function login(pass: string): Promise<string | null> {
  try {
    const res = await api('ping', {}, pass)
    if (res.status === 401) return 'Password salah'
    if (!res.ok || !isApi(res)) return `Server tidak siap (${res.status})`
    try {
      localStorage.setItem(K_PASS, pass)
    } catch {
      return 'Browser menolak menyimpan password'
    }
    setState({ status: 'syncing' })
    await syncNow(true)
    return null
  } catch {
    return 'Tidak bisa terhubung ke server'
  }
}

export function logout() {
  try {
    localStorage.removeItem(K_PASS)
  } catch {
    /* abaikan */
  }
  setState({ status: 'login', message: undefined })
}

export async function initSync(localKeys: string[]) {
  meta = (await get<LocalMeta>(K_META)) ?? {}
  // Data lokal lama yang belum pernah disinkron: ikut dikirim, tapi kalah dari versi cloud mana pun.
  for (const k of localKeys) if (!meta[k]) meta[k] = { updatedAt: 1, dirty: true }
  await saveMeta()

  // Tarik perubahan dari perangkat lain saat tab aktif lagi / kembali online / tiap menit.
  const again = () => document.visibilityState === 'visible' && syncNow()
  document.addEventListener('visibilitychange', again)
  window.addEventListener('focus', again)
  window.addEventListener('online', () => syncNow(true))
  setInterval(again, 60_000)

  let res: Response
  try {
    res = await api('ping')
  } catch {
    setState({ status: 'offline' })
    return
  }
  if (!isApi(res)) return setState({ status: 'unavailable' }) // hosting statis / mode dev
  if (res.status === 503) return setState({ status: 'error', message: (await res.json()).error })
  if (res.status === 401) return setState({ status: 'login' })
  setState({ status: 'ok' })
  await syncNow(true)
}

export const getSyncState = () => state
export function onSyncState(f: (s: SyncState) => void) {
  stateListeners.add(f)
  return () => stateListeners.delete(f)
}
export function onRemoteChange(f: (keys: string[]) => void) {
  remoteListeners.add(f)
  return () => remoteListeners.delete(f)
}
