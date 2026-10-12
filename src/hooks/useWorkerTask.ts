import { useEffect, useState } from 'react'

/** Worker → 화면 메시지 */
export type WorkerMessage<R> =
  | { type: 'progress'; result: R; progress: number }
  | { type: 'done'; result: R }
  | { type: 'error'; message: string }

export interface WorkerTaskState<R> {
  status: 'idle' | 'running' | 'done' | 'error'
  /** 계산 중에는 직전 결과(또는 중간 결과)가 들어 있을 수 있다 */
  result: R | null
  /** 진행률 (0~1) */
  progress: number
  error: string | null
}

const IDLE = { status: 'idle', result: null, progress: 0, error: null } as const

/** 입력이 멈춘 뒤 이 시간만큼 기다렸다가 계산을 시작한다 */
const DEBOUNCE_MS = 120

/**
 * 요청이 바뀔 때마다 새 Worker를 만들어 계산한다. 이전 계산은 Worker를 종료해 즉시 취소한다.
 * createWorker는 모듈 최상위에 정의한 함수를 넘길 것 (Vite가 Worker 파일을 번들링하려면
 * `new Worker(new URL('...', import.meta.url))` 형태가 코드에 그대로 있어야 한다).
 */
export function useWorkerTask<Q, R>(createWorker: () => Worker, request: Q | null): WorkerTaskState<R> {
  const key = request === null ? null : JSON.stringify(request)
  // 어떤 요청에 대한 상태인지 key와 함께 저장한다
  const [state, setState] = useState<WorkerTaskState<R> & { key: string | null }>({ ...IDLE, key: null })

  useEffect(() => {
    if (key === null) return

    let worker: Worker | null = null
    const timer = setTimeout(() => {
      worker = createWorker()
      worker.onmessage = (event: MessageEvent<WorkerMessage<R>>) => {
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
      worker.postMessage(JSON.parse(key) as Q)
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      worker?.terminate()
    }
  }, [key, createWorker])

  if (key === null) return IDLE
  if (state.key !== key) {
    // 새 요청의 첫 결과가 오기 전: 직전 결과를 흐리게 보여주며 계산 중으로 표시
    return { status: 'running', result: state.status === 'error' ? null : state.result, progress: 0, error: null }
  }
  return state
}
