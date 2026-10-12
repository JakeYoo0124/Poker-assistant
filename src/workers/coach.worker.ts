/// <reference lib="webworker" />
import { coachDecision, type CoachFeedback, type CoachRequest } from '../core/coach'

export interface CoachJob {
  id: number
  request: CoachRequest
}

export type CoachReply = { id: number; feedback: CoachFeedback } | { id: number; error: string }

self.onmessage = (event: MessageEvent<CoachJob>) => {
  const { id, request } = event.data
  try {
    self.postMessage({ id, feedback: coachDecision(request) } satisfies CoachReply)
  } catch (e) {
    self.postMessage({ id, error: e instanceof Error ? e.message : String(e) } satisfies CoachReply)
  }
}
