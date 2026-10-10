/// <reference lib="webworker" />
import { inspect, parse, type ParseOptions, type ParseResult, type SheetInfo } from './parseCore'

export type { ParseResult, SheetInfo }

export type WorkerRequest =
  | { type: 'inspect'; buf: ArrayBuffer }
  | { type: 'parse'; buf: ArrayBuffer; opt: ParseOptions }

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
      self.postMessage({ type: 'parse', result: parse(msg.buf, msg.opt) } satisfies WorkerResponse)
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) } satisfies WorkerResponse)
  }
}
