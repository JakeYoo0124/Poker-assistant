import type { EquityRequest, EquityResult } from '../core/equity'
import type { WorkerMessage } from '../hooks/useWorkerTask'

export type EquityJob = EquityRequest

export type EquityMessage = WorkerMessage<EquityResult>
