import { describe, expect, it } from 'vitest'
import { gunzipJson, gzipJson, idbKey, rowsKey } from '../sync'

describe('sync helpers', () => {
  it('gzip JSON bolak-balik', async () => {
    const v = { a: [1, 2, 3], b: 'Rp 1.000', c: null }
    const buf = await gzipJson(v)
    expect(new Uint8Array(buf).slice(0, 2)).toEqual(new Uint8Array([0x1f, 0x8b])) // header gzip
    expect(await gunzipJson(buf)).toEqual(v)
  })
  it('pemetaan kunci sinkron ke IndexedDB', () => {
    expect(idbKey('configs')).toBe('salesdeck:configs')
    expect(idbKey('targets')).toBe('salesdeck:targets')
    expect(idbKey(rowsKey('d3'))).toBe('salesdeck:rows:d3')
  })
})
