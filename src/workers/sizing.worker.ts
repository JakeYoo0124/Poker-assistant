/// <reference lib="webworker" />
import { postflopAdvice, type PostflopAdvice, type PostflopInput } from '../core/sizing'
import type { WorkerMessage } from '../hooks/useWorkerTask'

const post = (msg: WorkerMessage<PostflopAdvice>) => self.postMessage(msg)

self.onmessage = (event: MessageEvent<Omit<PostflopInput, 'random'>>) => {
  try {
    post({ type: 'done', result: postflopAdvice(event.data) })
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) })
  }
}
