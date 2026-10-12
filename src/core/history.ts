/**
 * 핸드 기록 모델과 리플레이 계산 (금액 단위: BB)
 *
 * 한 명의 주요 상대(villain)와의 대결로 기록한다. 멀티웨이 팟은 다른 사람이 프리플랍에 폴드했다고 보고,
 * 그들이 낸 블라인드는 데드 머니로 팟에 넣는다.
 *
 * 액션 금액의 뜻 (연습 게임 로그와 같다)
 *   call      : 이번에 낸 금액
 *   bet/raise : 이번 스트리트의 총 베팅 금액(to)
 */

import type { Card } from './cards'
import { chips, type HandState, type PlayerId, type Street } from './game'
import type { Verdict } from './coach'

export const TABLE_POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const
export type TablePosition = (typeof TABLE_POSITIONS)[number]

export const STREETS: readonly Street[] = ['preflop', 'flop', 'turn', 'river']
export const STREET_LABELS: Record<Street, string> = { preflop: '프리플랍', flop: '플랍', turn: '턴', river: '리버' }
export const BOARD_SIZE_BY_STREET: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 }

export type Actor = 'hero' | 'villain'
export type HistoryActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise'

export interface HistoryAction {
  street: Street
  actor: Actor
  type: HistoryActionType
  amount: number
  allIn?: boolean
}

export interface PracticeFeedbackRecord {
  street: Street
  verdict: Verdict
  chosen: string
  recommended: string
  evLoss: number | null
}

export interface StoredHand {
  id?: number
  /** ISO 시각 */
  createdAt: string
  source: 'practice' | 'manual'
  sessionId: number | null
  heroPosition: TablePosition
  villainPosition: TablePosition | null
  /** 핸드 시작 시 유효 스택 (BB) */
  effectiveStack: number
  heroCards: Card[]
  /** 모르면 null */
  villainCards: Card[] | null
  board: Card[]
  actions: HistoryAction[]
  /** 이번 핸드의 내 손익 (BB) */
  heroNet: number
  notes: string
  practice?: { profileId: string; feedback: PracticeFeedbackRecord[] }
}

export interface StoredSession {
  id?: number
  /** YYYY-MM-DD */
  date: string
  kind: 'live' | 'online'
  venue: string
  /** 예: "1000/2000" */
  stakes: string
  /** 1 BB가 얼마인지 (원). BB 환산에 쓴다 */
  bbValue: number
  buyIn: number
  cashOut: number
  /** 플레이 시간 (시간) */
  hours: number
  notes: string
}

/** 세션 손익 (원) */
export const sessionProfit = (s: StoredSession) => s.cashOut - s.buyIn

/** 세션 손익 (BB) */
export const sessionProfitBB = (s: StoredSession) => (s.bbValue > 0 ? sessionProfit(s) / s.bbValue : 0)

// ───────────────────────── 블라인드와 진행 상태 ─────────────────────────

export interface Blinds {
  hero: number
  villain: number
  /** 다른 사람이 낸 블라인드 (데드 머니) */
  dead: number
}

export function blindsFor(heroPos: TablePosition, villainPos: TablePosition | null): Blinds {
  const post = (p: TablePosition | null) => (p === 'SB' ? 0.5 : p === 'BB' ? 1 : 0)
  const hero = post(heroPos)
  const villain = villainPos === heroPos ? 0 : post(villainPos)
  return { hero, villain, dead: chips(1.5 - hero - villain) }
}

export interface StreetState {
  street: Street
  /** 이전 스트리트까지 모인 팟 (데드 머니 포함) */
  pot: number
  committed: Record<Actor, number>
  currentBet: number
  /** 지금까지 각자 낸 총액 (블라인드 포함) */
  invested: Record<Actor, number>
  folded: Actor | null
}

/** 액션을 차례로 적용한 상태. upTo를 주면 그 개수만큼만 적용한다. */
export function playActions(hand: Pick<StoredHand, 'heroPosition' | 'villainPosition' | 'actions'>, upTo?: number): StreetState {
  const blinds = blindsFor(hand.heroPosition, hand.villainPosition)
  const st: StreetState = {
    street: 'preflop',
    pot: blinds.dead,
    committed: { hero: blinds.hero, villain: blinds.villain },
    currentBet: Math.max(1, blinds.hero, blinds.villain),
    invested: { hero: blinds.hero, villain: blinds.villain },
    folded: null,
  }
  const actions = hand.actions.slice(0, upTo ?? hand.actions.length)
  for (const a of actions) {
    if (a.street !== st.street) {
      st.pot = chips(st.pot + st.committed.hero + st.committed.villain)
      st.committed = { hero: 0, villain: 0 }
      st.currentBet = 0
      st.street = a.street
    }
    if (a.type === 'fold') st.folded = a.actor
    else if (a.type === 'call') {
      st.committed[a.actor] = chips(st.committed[a.actor] + a.amount)
      st.invested[a.actor] = chips(st.invested[a.actor] + a.amount)
    } else if (a.type === 'bet' || a.type === 'raise') {
      const add = chips(a.amount - st.committed[a.actor])
      st.committed[a.actor] = a.amount
      st.invested[a.actor] = chips(st.invested[a.actor] + add)
      st.currentBet = Math.max(st.currentBet, a.amount)
    }
  }
  return st
}

export const potTotal = (st: StreetState) => chips(st.pot + st.committed.hero + st.committed.villain)

/** actor가 지금 콜하려면 내야 하는 금액 */
export function toCall(st: StreetState, actor: Actor): number {
  return Math.max(0, chips(st.currentBet - st.committed[actor]))
}

/**
 * 결과 버튼용 손익 계산.
 * 한쪽이 더 많이 넣은 금액(콜받지 못한 베팅, 짧은 올인과의 차액)은 그 사람에게 돌려주고,
 * 양쪽이 똑같이 넣은 금액 + 데드 머니만 다툰 팟으로 본다.
 */
export function suggestedNet(hand: Pick<StoredHand, 'heroPosition' | 'villainPosition' | 'actions'>, outcome: 'win' | 'lose' | 'split'): number {
  const st = playActions(hand)
  const contested = Math.min(st.invested.hero, st.invested.villain)
  const refundHero = chips(st.invested.hero - contested)
  const refundVillain = chips(st.invested.villain - contested)
  const pot = chips(st.pot + st.committed.hero + st.committed.villain - refundHero - refundVillain)
  const heroIn = chips(st.invested.hero - refundHero)
  if (outcome === 'win') return chips(pot - heroIn)
  if (outcome === 'lose') return chips(-heroIn)
  return chips(pot / 2 - heroIn)
}

// ───────────────────────── 리플레이 ─────────────────────────

export interface ReplayStep {
  street: Street
  /** 이 시점에 보이는 보드 */
  board: Card[]
  pot: number
  committed: Record<Actor, number>
  /** 이 단계에서 일어난 액션 (0단계는 블라인드) */
  action: HistoryAction | null
}

export function replaySteps(hand: StoredHand): ReplayStep[] {
  const steps: ReplayStep[] = []
  for (let i = 0; i <= hand.actions.length; i++) {
    const st = playActions(hand, i)
    const action = i === 0 ? null : hand.actions[i - 1]
    steps.push({
      street: st.street,
      board: hand.board.slice(0, BOARD_SIZE_BY_STREET[st.street]),
      pot: potTotal(st),
      committed: { ...st.committed },
      action,
    })
  }
  // 마지막에 남은 보드(올인 런아웃 등)를 모두 보여주는 단계
  const last = steps[steps.length - 1]
  if (last.board.length < hand.board.length) {
    steps.push({ ...last, street: 'river', board: [...hand.board], action: null })
  }
  return steps
}

export function actionLabel(a: HistoryAction): string {
  const allIn = a.allIn ? ' (올인)' : ''
  switch (a.type) {
    case 'fold':
      return '폴드'
    case 'check':
      return '체크'
    case 'call':
      return `콜 ${a.amount} BB${allIn}`
    case 'bet':
      return `베팅 ${a.amount} BB${allIn}`
    case 'raise':
      return `레이즈 ${a.amount} BB${allIn}`
  }
}

// ───────────────────────── 연습 게임 → 기록 ─────────────────────────

export function practiceToStored(
  hand: HandState,
  hero: PlayerId,
  profileId: string,
  feedback: PracticeFeedbackRecord[],
): StoredHand {
  if (!hand.result) throw new Error('끝난 핸드만 저장할 수 있습니다')
  const villain: PlayerId = hero === 0 ? 1 : 0
  const heroIsButton = hand.button === hero
  return {
    createdAt: new Date().toISOString(),
    source: 'practice',
    sessionId: null,
    heroPosition: heroIsButton ? 'SB' : 'BB',
    villainPosition: heroIsButton ? 'BB' : 'SB',
    effectiveStack: Math.min(hand.startStacks[0], hand.startStacks[1]),
    heroCards: [...hand.holes[hero]],
    // 쇼다운에서만 상대 카드를 볼 수 있다
    villainCards: hand.result.showdown ? [...hand.holes[villain]] : null,
    board: [...hand.board],
    actions: hand.log.map((r) => ({
      street: r.street,
      actor: r.player === hero ? 'hero' : 'villain',
      type: r.type,
      amount: r.amount,
      allIn: r.allIn,
    })),
    heroNet: chips(hand.stacks[hero] - hand.startStacks[hero]),
    notes: '',
    practice: { profileId, feedback },
  }
}
