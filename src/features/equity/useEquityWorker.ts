import { useEffect, useState } from 'react'
import type { EquityRequest, EquityResult } from '../../core/equity'
import type { EquityMessage } from '../../workers/equityProtocol'

export interface EquityWorkerState {
  status: 'idle' | 'running' | 'done' | 'error'
  /** 계산 중에는 직전 결과(또는 중간 결과)가 들어 있을 수 있다 */
  result: EquityResult | null
  /** 시뮬레이션 진행률 (0~1). 정확 계산이면 완료 시 1 */
  progress: number
  error: string | null
}

const IDLE: EquityWorkerState = { status: 'idle', result: null, progress: 0, error: null }

/** 입력이 멈춘 뒤 이 시간만큼 기다렸다가 계산을 시작한다 */
const DEBOUNCE_MS = 120

/**
 * 요청이 바뀔 때마다 새 Worker에서 에퀴티를 계산한다.
 * 이전 계산은 Worker를 종료해서 즉시 취소한다.
 */
export function useEquityWorker(request: EquityRequest | null): EquityWorkerState {
  const key = request ? JSON.stringify(request) : null
  // 어떤 요청에 대한 상태인지 key와 함께 저장한다
  const [state, setState] = useState<EquityWorkerState & { key: string | null }>({ ...IDLE, key: null })

  useEffect(() => {
    if (key === null) return

    let worker: Worker | null = null
    const timer = setTimeout(() => {
      worker = new Worker(new URL('../../workers/equity.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<EquityMessage>) => {
        const msg = event.data
        if (msg.type === 'progress') {
          setState({ key, status: 'running', result: msg.result, progress: msg.progress, error: null })
        } else if (msg.type === 'done') {
          setState({ key, status: 'done', result: msg.result, progress: 1, error: null })
          worker?.terminate()
        } else {
          setState({ key, status: 'error', result: null, progress: 0, error: msg.message })
          worker?.terminate()
        }
      }
      worker.postMessage(JSON.parse(key) as EquityRequest)
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      worker?.terminate()
    }
  }, [key])

  if (key === null) return IDLE
  if (state.key !== key) {
    // 새 요청의 첫 결과가 오기 전: 직전 결과를 흐리게 보여주며 계산 중으로 표시
    return { status: 'running', result: state.status === 'error' ? null : state.result, progress: 0, error: null }
  }
  return state
}
