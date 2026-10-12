import { create } from 'zustand'
import { BOT_PROFILES, botDecision, estimateRangePct, preflopSituation, type BotProfileId } from '../../core/bot'
import type { CoachFeedback, CoachRequest } from '../../core/coach'
import {
  applyAction,
  currentBet,
  legalActions,
  netResult,
  newHand,
  totalPot,
  type Action,
  type HandState,
  type PlayerId,
  type Street,
} from '../../core/game'
import { practiceToStored, type PracticeFeedbackRecord } from '../../core/history'
import { addHand, updateHand } from '../../db'
import type { CoachJob, CoachReply } from '../../workers/coach.worker'

/** 사람 = 플레이어 0, AI = 플레이어 1 */
export const HERO: PlayerId = 0
export const BOT: PlayerId = 1

/** AI가 생각하는 것처럼 보이도록 기다리는 시간 */
const BOT_DELAY_MS = 700

export interface FeedbackEntry {
  id: number
  handNo: number
  street: Street
  status: 'pending' | 'done' | 'error'
  feedback?: CoachFeedback
  error?: string
}

interface PracticeState {
  profileId: BotProfileId
  startingStack: number
  hand: HandState | null
  handNo: number
  handsPlayed: number
  /** 세션 누적 손익 (BB) */
  heroNet: number
  feedback: FeedbackEntry[]
  botThinking: boolean

  setProfile: (id: BotProfileId) => void
  setStartingStack: (bb: number) => void
  newSession: () => void
  nextHand: () => void
  heroAct: (action: Action) => void
}

// ───────── 코치 Worker (세션 동안 하나를 계속 쓴다) ─────────

let coachWorker: Worker | null = null
let nextFeedbackId = 1

function getCoachWorker(onReply: (reply: CoachReply) => void): Worker {
  if (!coachWorker) {
    coachWorker = new Worker(new URL('../../workers/coach.worker.ts', import.meta.url), { type: 'module' })
  }
  coachWorker.onmessage = (e: MessageEvent<CoachReply>) => onReply(e.data)
  return coachWorker
}

function coachRequest(s: HandState, profileId: BotProfileId, action: Action): CoachRequest {
  const legal = legalActions(s)
  const profile = BOT_PROFILES[profileId]
  return {
    street: s.street,
    hole: s.holes[HERO],
    board: s.board,
    pot: totalPot(s),
    toCall: legal.callAmount,
    currentBet: currentBet(s),
    canRaise: legal.canRaise,
    heroStack: s.stacks[HERO],
    villainStack: s.stacks[BOT],
    situation: s.street === 'preflop' ? preflopSituation(s, HERO) : null,
    inPosition: HERO !== s.button,
    villainPct: estimateRangePct(s.log, BOT, s.button, profile),
    villainStyle: profile.coachStyle,
    action,
  }
}

function feedbackRecords(entries: FeedbackEntry[], handNo: number): PracticeFeedbackRecord[] {
  return entries
    .filter((e) => e.handNo === handNo && e.status === 'done' && e.feedback)
    .reverse()
    .map((e) => ({
      street: e.street,
      verdict: e.feedback!.verdict,
      chosen: e.feedback!.chosen,
      recommended: e.feedback!.recommended,
      evLoss: e.feedback!.evLoss,
    }))
}

export const usePracticeStore = create<PracticeState>((set, get) => {
  /** 핸드 번호 → 핸드 기록 DB id (코치 피드백이 늦게 도착하면 기록을 갱신하려고 보관) */
  const savedIds = new Map<number, Promise<number | null>>()

  const saveHand = (hand: HandState, handNo: number) => {
    const { profileId, feedback } = get()
    const stored = practiceToStored(hand, HERO, profileId, feedbackRecords(feedback, handNo))
    savedIds.set(
      handNo,
      addHand(stored).catch((e) => {
        console.error('연습 핸드 저장 실패', e)
        return null
      }),
    )
  }

  const refreshSavedFeedback = (handNo: number) => {
    const pending = savedIds.get(handNo)
    if (!pending) return
    void pending.then((id) => {
      if (id === null) return
      const { profileId, feedback } = get()
      return updateHand(id, { practice: { profileId, feedback: feedbackRecords(feedback, handNo) } })
    })
  }

  /** 핸드가 끝났으면 세션 기록에 반영하고 핸드 기록에 저장 */
  const settle = (hand: HandState) => {
    if (hand.result) {
      set((st) => ({ heroNet: Math.round((st.heroNet + netResult(hand)[HERO]) * 100) / 100, handsPlayed: st.handsPlayed + 1 }))
      saveHand(hand, get().handNo)
    }
  }

  const runBot = () => {
    const { hand, handNo } = get()
    if (!hand || hand.toAct !== BOT) {
      set({ botThinking: false })
      return
    }
    set({ botThinking: true })
    setTimeout(() => {
      const st = get()
      // 그 사이 새 핸드·세션이 시작됐으면 무시
      if (st.handNo !== handNo || !st.hand || st.hand.toAct !== BOT) return
      const next = applyAction(st.hand, BOT, botDecision(st.hand, BOT, BOT_PROFILES[st.profileId]))
      set({ hand: next })
      settle(next)
      runBot()
    }, BOT_DELAY_MS)
  }

  const onCoachReply = (reply: CoachReply) => {
    set((st) => ({
      feedback: st.feedback.map((f) =>
        f.id !== reply.id
          ? f
          : 'feedback' in reply
            ? { ...f, status: 'done', feedback: reply.feedback }
            : { ...f, status: 'error', error: reply.error },
      ),
    }))
    const entry = get().feedback.find((f) => f.id === reply.id)
    if (entry) refreshSavedFeedback(entry.handNo)
  }

  return {
    profileId: 'tag',
    startingStack: 100,
    hand: null,
    handNo: 0,
    handsPlayed: 0,
    heroNet: 0,
    feedback: [],
    botThinking: false,

    setProfile: (profileId) => set({ profileId }),
    setStartingStack: (startingStack) => set({ startingStack: Math.max(10, Math.min(500, startingStack)) }),

    newSession: () => {
      // 핸드 번호가 1부터 다시 시작하므로 이전 세션의 저장 기록과 섞이지 않게 비운다
      savedIds.clear()
      set({ handNo: 0, handsPlayed: 0, heroNet: 0, feedback: [], hand: null })
      get().nextHand()
    },

    nextHand: () => {
      const { startingStack, handNo } = get()
      // 매 핸드 양쪽 스택을 시작 스택으로 채운다. 버튼은 번갈아 맡는다.
      const button: PlayerId = handNo % 2 === 0 ? HERO : BOT
      const hand = newHand([startingStack, startingStack], button)
      set({ hand, handNo: handNo + 1 })
      settle(hand)
      runBot()
    },

    heroAct: (action) => {
      const { hand, handNo, profileId } = get()
      if (!hand || hand.toAct !== HERO) return
      const next = applyAction(hand, HERO, action) // 잘못된 행동이면 여기서 오류

      const id = nextFeedbackId++
      const entry: FeedbackEntry = { id, handNo, street: hand.street, status: 'pending' }
      set((st) => ({ hand: next, feedback: [entry, ...st.feedback] }))
      const job: CoachJob = { id, request: coachRequest(hand, profileId, action) }
      getCoachWorker(onCoachReply).postMessage(job)

      settle(next)
      runBot()
    },
  }
})
