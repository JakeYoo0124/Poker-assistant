import type { EquityRequest, EquityResult } from '../core/equity'

export type EquityJob = EquityRequest

export type EquityMessage =
  | { type: 'progress'; result: EquityResult; progress: number }
  | { type: 'done'; result: EquityResult }
  | { type: 'error'; message: string }
