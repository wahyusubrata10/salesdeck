// API sinkronisasi SalesDeck (Cloudflare Pages Functions + KV).
//
//   GET  /api/ping          -> cek password
//   GET  /api/meta          -> { [key]: { updatedAt, size } }
//   GET  /api/data/:key     -> isi (gzip JSON) yang tersimpan
//   PUT  /api/data/:key     -> simpan isi; header X-Updated-At = waktu perubahan (ms)
//
// Semua request wajib membawa header "Authorization: Bearer <APP_PASSWORD>".

export interface KV {
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>
  get(key: string, type: 'json'): Promise<unknown>
  put(key: string, value: ArrayBuffer | string): Promise<void>
}

export interface Env {
  SALESDECK: KV
  APP_PASSWORD?: string
}

export type Meta = Record<string, { updatedAt: number; size: number }>

const KEY_RE = /^[a-z0-9-]{1,40}$/
const MAX_BYTES = 20 * 1024 * 1024 // batas KV 25 MB

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

// Perbandingan waktu-konstan agar password tidak bisa ditebak dari lama respons.
async function safeEqual(a: string, b: string) {
  const enc = new TextEncoder()
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))])
  const x = new Uint8Array(ha)
  const y = new Uint8Array(hb)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

export async function handle(request: Request, env: Env): Promise<Response> {
  if (!env.SALESDECK || !env.APP_PASSWORD) {
    return json({ error: 'Server belum dikonfigurasi (binding KV SALESDECK / APP_PASSWORD).' }, 503)
  }
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || !(await safeEqual(token, env.APP_PASSWORD))) return json({ error: 'Password salah' }, 401)

  const url = new URL(request.url)
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)

  if (parts[0] === 'ping' && request.method === 'GET') return json({ ok: true })

  if (parts[0] === 'meta' && request.method === 'GET') {
    return json(((await env.SALESDECK.get('meta', 'json')) as Meta | null) ?? {})
  }

  if (parts[0] === 'data' && parts[1] && KEY_RE.test(parts[1]) && parts.length === 2) {
    const key = parts[1]
    if (request.method === 'GET') {
      const body = await env.SALESDECK.get(`data:${key}`, 'arrayBuffer')
      if (!body) return json({ error: 'Tidak ada' }, 404)
      return new Response(body, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' } })
    }
    if (request.method === 'PUT') {
      const body = await request.arrayBuffer()
      if (body.byteLength > MAX_BYTES) return json({ error: 'Data terlalu besar' }, 413)
      const updatedAt = Number(request.headers.get('x-updated-at')) || Date.now()
      await env.SALESDECK.put(`data:${key}`, body)
      // Klien mengirim perubahan berurutan, jadi baca-ubah-tulis meta ini aman untuk satu pengguna.
      const meta = ((await env.SALESDECK.get('meta', 'json')) as Meta | null) ?? {}
      meta[key] = { updatedAt, size: body.byteLength }
      await env.SALESDECK.put('meta', JSON.stringify(meta))
      return json({ ok: true, updatedAt })
    }
  }
  return json({ error: 'Tidak ditemukan' }, 404)
}
