import type { EquityRequest, EquityResult } from '../../core/equity'
import { useWorkerTask, type WorkerTaskState } from '../../hooks/useWorkerTask'

export type EquityWorkerState = WorkerTaskState<EquityResult>

const createEquityWorker = () =>
  new Worker(new URL('../../workers/equity.worker.ts', import.meta.url), { type: 'module' })

export function useEquityWorker(request: EquityRequest | null): EquityWorkerState {
  return useWorkerTask<EquityRequest, EquityResult>(createEquityWorker, request)
}
