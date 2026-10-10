import type { ParseResult, SheetInfo, WorkerRequest, WorkerResponse } from './excel.worker'
import type { ParseOptions } from './parseCore'

export type { ParseResult, SheetInfo }

// Urutan sheet yang paling mungkin berisi data transaksi.
export const rankSheets = (sheets: SheetInfo[]) =>
  [...sheets].sort((a, b) => b.score - a.score || b.rows - a.rows)

function run(req: WorkerRequest): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./excel.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      w.terminate()
      if (e.data.type === 'error') reject(new Error(e.data.message))
      else resolve(e.data)
    }
    w.onerror = (e) => {
      w.terminate()
      reject(new Error(e.message || 'Gagal membaca file'))
    }
    // Buffer disalin (bukan ditransfer) agar bisa dipakai lagi untuk langkah parse.
    w.postMessage(req)
  })
}

export async function inspectWorkbook(buf: ArrayBuffer): Promise<SheetInfo[]> {
  const res = await run({ type: 'inspect', buf })
  if (res.type !== 'inspect') throw new Error('Respons tidak terduga')
  return res.sheets
}

export async function parseWorkbook(buf: ArrayBuffer, opt: ParseOptions): Promise<ParseResult> {
  const res = await run({ type: 'parse', buf, opt })
  if (res.type !== 'parse') throw new Error('Respons tidak terduga')
  return res.result
}
