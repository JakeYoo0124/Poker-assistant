/// <reference lib="webworker" />
import { EXACT_LIMIT, MonteCarloEquity, calculateExact, exactWork } from '../core/equity'
import type { EquityJob, EquityMessage } from './equityProtocol'

/** 시뮬레이션 목표 횟수와 시간 제한 (먼저 도달하는 쪽에서 멈춘다) */
const MC_TARGET = 500_000
const MC_TIME_LIMIT_MS = 2_000
const MC_BATCH = 20_000

const post = (msg: EquityMessage) => self.postMessage(msg)

self.onmessage = (event: MessageEvent<EquityJob>) => {
  const req = event.data
  try {
    if (exactWork(req) <= EXACT_LIMIT) {
      post({ type: 'done', result: calculateExact(req) })
      return
    }

    const mc = new MonteCarloEquity(req)
    const start = performance.now()
    while (mc.samples < MC_TARGET && performance.now() - start < MC_TIME_LIMIT_MS) {
      mc.run(MC_BATCH)
      post({ type: 'progress', result: mc.result(), progress: mc.samples / MC_TARGET })
    }
    post({ type: 'done', result: mc.result() })
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) })
  }
}
