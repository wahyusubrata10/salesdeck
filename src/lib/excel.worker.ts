/// <reference lib="webworker" />
import { inspect, parse, type ParseResult, type SheetInfo } from './parseCore'
import type { FieldKey } from './types'

export type { ParseResult, SheetInfo }

export type WorkerRequest =
  | { type: 'inspect'; buf: ArrayBuffer }
  | { type: 'parse'; buf: ArrayBuffer; sheet: string; headerRow: number; mapping: Partial<Record<FieldKey, string>> }

export type WorkerResponse =
  | { type: 'inspect'; sheets: SheetInfo[] }
  | { type: 'parse'; result: ParseResult }
  | { type: 'error'; message: string }

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  try {
    if (msg.type === 'inspect') {
      self.postMessage({ type: 'inspect', sheets: inspect(msg.buf) } satisfies WorkerResponse)
    } else {
      self.postMessage({ type: 'parse', result: parse(msg.buf, msg.sheet, msg.headerRow, msg.mapping) } satisfies WorkerResponse)
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) } satisfies WorkerResponse)
  }
}
