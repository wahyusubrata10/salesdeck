import { describe, expect, it } from 'vitest'
import { handle, type Env, type KV } from './api'

function fakeKV(): KV {
  const m = new Map<string, ArrayBuffer | string>()
  return {
    async get(key: string, type: 'arrayBuffer' | 'json') {
      const v = m.get(key)
      if (v == null) return null
      if (type === 'json') return JSON.parse(typeof v === 'string' ? v : new TextDecoder().decode(v))
      return typeof v === 'string' ? new TextEncoder().encode(v).buffer : v
    },
    async put(key: string, value: ArrayBuffer | string) {
      m.set(key, value)
    },
  } as KV
}

const env: Env = { SALESDECK: fakeKV(), APP_PASSWORD: 'rahasia' }
const req = (path: string, init: RequestInit & { pass?: string } = {}) =>
  handle(new Request(`https://x.pages.dev/api/${path}`, { ...init, headers: { authorization: `Bearer ${init.pass ?? 'rahasia'}`, ...(init.headers ?? {}) } }), env)

describe('API sinkronisasi', () => {
  it('menolak password salah / kosong', async () => {
    expect((await req('ping', { pass: 'salah' })).status).toBe(401)
    expect((await handle(new Request('https://x/api/ping'), env)).status).toBe(401)
    expect((await req('ping')).status).toBe(200)
  })

  it('503 bila belum dikonfigurasi', async () => {
    const r = await handle(new Request('https://x/api/ping'), { SALESDECK: fakeKV() })
    expect(r.status).toBe(503)
  })

  it('simpan & ambil data, meta ikut diperbarui', async () => {
    const body = new TextEncoder().encode('isi-gzip').buffer
    const put = await req('data/rows-d1', { method: 'PUT', body, headers: { 'x-updated-at': '1234' } })
    expect(put.status).toBe(200)
    const got = await req('data/rows-d1')
    expect(new TextDecoder().decode(await got.arrayBuffer())).toBe('isi-gzip')
    expect(await (await req('meta')).json()).toEqual({ 'rows-d1': { updatedAt: 1234, size: 8 } })
  })

  it('menolak kunci tidak valid', async () => {
    expect((await req('data/../rahasia')).status).toBe(404)
    expect((await req('data/BESAR')).status).toBe(404)
    expect((await req('data/belum-ada')).status).toBe(404)
  })
})
