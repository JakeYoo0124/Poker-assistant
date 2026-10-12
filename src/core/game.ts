/**
 * 헤즈업 노리밋 홀덤 진행 (금액 단위: BB)
 *
 * 플레이어 0, 1. 버튼(button)이 스몰 블라인드를 내고 프리플랍에 먼저, 플랍 이후에는 나중에 행동한다.
 * 상태는 불변 객체로 다루며 applyAction()이 새 상태를 돌려준다.
 */

import { shuffle, type Card } from './cards'
import type { Combo } from './equity'
import { evaluate } from './evaluator'

export type PlayerId = 0 | 1
export type Street = 'preflop' | 'flop' | 'turn' | 'river'

export const SMALL_BLIND = 0.5
export const BIG_BLIND = 1

export type Action = { type: 'fold' } | { type: 'check' } | { type: 'call' } | { type: 'raise'; to: number }

export interface ActionRecord {
  player: PlayerId
  street: Street
  type: 'fold' | 'check' | 'call' | 'bet' | 'raise'
  /** call: 낸 금액 / bet·raise: 이번 스트리트 총 베팅 금액(to) */
  amount: number
  allIn: boolean
}

export interface HandResult {
  /** 팟을 가져간 플레이어 (스플릿이면 2명) */
  winners: PlayerId[]
  /** 각자 팟에서 받은 금액 */
  payouts: [number, number]
  showdown: boolean
  /** 쇼다운했을 때 각자의 족보 점수 */
  scores: [number, number] | null
}

export interface HandState {
  button: PlayerId
  holes: [Combo, Combo]
  /** 남은 덱 (끝에서부터 뽑는다) */
  deck: Card[]
  board: Card[]
  street: Street
  /** 각자 남은 스택 */
  stacks: [number, number]
  /** 이번 스트리트에 각자 낸 금액 */
  committed: [number, number]
  /** 이전 스트리트까지 모인 팟 */
  pot: number
  /** 다음에 행동할 플레이어. 핸드가 끝나면 null */
  toAct: PlayerId | null
  /** 최소 레이즈 증가분 */
  lastRaise: number
  /** 이번 스트리트에 자발적으로 행동했는지 (블라인드는 제외) */
  acted: [boolean, boolean]
  log: ActionRecord[]
  result: HandResult | null
  startStacks: [number, number]
}

export interface LegalActions {
  canFold: boolean
  canCheck: boolean
  /** 콜할 금액 (0이면 콜 불가, 체크 가능) */
  callAmount: number
  canRaise: boolean
  /** 레이즈 가능한 최소/최대 총액 (이번 스트리트 기준) */
  minRaiseTo: number
  maxRaiseTo: number
}

/** 부동소수 오차를 없애기 위해 0.01 BB 단위로 반올림 */
export const chips = (x: number) => Math.round(x * 100) / 100

const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0)

/** 이번 스트리트의 최고 베팅 */
export function currentBet(s: HandState): number {
  return Math.max(s.committed[0], s.committed[1])
}

/** 팟 전체 (이번 스트리트 베팅 포함) */
export function totalPot(s: HandState): number {
  return chips(s.pot + s.committed[0] + s.committed[1])
}

export function newHand(stacks: [number, number], button: PlayerId, random: () => number = Math.random): HandState {
  if (!(stacks[0] > 0 && stacks[1] > 0)) throw new Error('두 플레이어 모두 칩이 있어야 합니다')
  const deck = shuffle(Array.from({ length: 52 }, (_, i) => i), random)
  const bb = other(button)
  const holes: [Combo, Combo] = [
    [deck.pop()!, deck.pop()!],
    [deck.pop()!, deck.pop()!],
  ]

  const committed: [number, number] = [0, 0]
  const left: [number, number] = [stacks[0], stacks[1]]
  committed[button] = Math.min(SMALL_BLIND, left[button])
  committed[bb] = Math.min(BIG_BLIND, left[bb])
  left[button] = chips(left[button] - committed[button])
  left[bb] = chips(left[bb] - committed[bb])

  const state: HandState = {
    button,
    holes,
    deck,
    board: [],
    street: 'preflop',
    stacks: left,
    committed,
    pot: 0,
    toAct: button,
    lastRaise: BIG_BLIND,
    acted: [false, false],
    log: [],
    result: null,
    startStacks: [stacks[0], stacks[1]],
  }
  return advance(state, null)
}

export function legalActions(s: HandState): LegalActions {
  const p = s.toAct
  if (p === null) {
    return { canFold: false, canCheck: false, callAmount: 0, canRaise: false, minRaiseTo: 0, maxRaiseTo: 0 }
  }
  const bet = currentBet(s)
  const toCall = chips(bet - s.committed[p])
  const maxRaiseTo = chips(s.committed[p] + s.stacks[p])
  const minFull = chips(bet + Math.max(s.lastRaise, BIG_BLIND))
  return {
    canFold: toCall > 0,
    canCheck: toCall === 0,
    callAmount: Math.min(toCall, s.stacks[p]),
    // 상대가 이미 올인이면 레이즈할 의미가 없다
    canRaise: s.stacks[p] > toCall && s.stacks[other(p)] > 0,
    minRaiseTo: Math.min(minFull, maxRaiseTo),
    maxRaiseTo,
  }
}

/** 행동이 남아 있는지: 칩이 있고, 아직 행동하지 않았거나 상대 베팅에 맞추지 못했으면 true */
function needsAction(s: HandState, i: PlayerId): boolean {
  return s.stacks[i] > 0 && (!s.acted[i] || s.committed[i] < currentBet(s))
}

export function applyAction(state: HandState, player: PlayerId, action: Action): HandState {
  if (state.toAct !== player) throw new Error('지금은 이 플레이어의 차례가 아닙니다')
  const legal = legalActions(state)
  const s: HandState = structuredClone(state)
  const p = player
  const record = (type: ActionRecord['type'], amount: number) =>
    s.log.push({ player: p, street: s.street, type, amount, allIn: s.stacks[p] === 0 })

  const put = (amount: number) => {
    s.committed[p] = chips(s.committed[p] + amount)
    s.stacks[p] = chips(s.stacks[p] - amount)
  }

  switch (action.type) {
    case 'fold': {
      if (!legal.canFold) throw new Error('폴드할 수 없습니다 (체크 가능)')
      record('fold', 0)
      const winner = other(p)
      const won = totalPot(s)
      s.pot = 0
      s.committed = [0, 0]
      s.stacks[winner] = chips(s.stacks[winner] + won)
      const payouts: [number, number] = [0, 0]
      payouts[winner] = won
      s.result = { winners: [winner], payouts, showdown: false, scores: null }
      s.toAct = null
      return s
    }
    case 'check':
      if (!legal.canCheck) throw new Error('체크할 수 없습니다 (콜할 금액이 있음)')
      s.acted[p] = true
      record('check', 0)
      break
    case 'call':
      if (legal.callAmount <= 0) throw new Error('콜할 금액이 없습니다')
      put(legal.callAmount)
      s.acted[p] = true
      record('call', legal.callAmount)
      break
    case 'raise': {
      if (!legal.canRaise) throw new Error('레이즈할 수 없습니다')
      const to = chips(action.to)
      if (to < legal.minRaiseTo || to > legal.maxRaiseTo) {
        throw new Error(`레이즈 금액은 ${legal.minRaiseTo} ~ ${legal.maxRaiseTo} BB 사이여야 합니다`)
      }
      const bet = currentBet(s)
      const increase = chips(to - bet)
      if (increase >= s.lastRaise) s.lastRaise = increase
      put(chips(to - s.committed[p]))
      s.acted[p] = true
      s.acted[other(p)] = false
      record(bet === 0 ? 'bet' : 'raise', to)
      break
    }
  }
  return advance(s, p)
}

/** 다음 행동자를 정하거나, 스트리트를 끝내고 다음 스트리트/쇼다운으로 넘어간다 (s를 직접 수정) */
function advance(s: HandState, lastActor: PlayerId | null): HandState {
  const first = lastActor === null ? s.toAct! : other(lastActor)
  if (needsAction(s, first)) {
    s.toAct = first
    return s
  }
  if (needsAction(s, other(first))) {
    s.toAct = other(first)
    return s
  }
  return endStreet(s)
}

function endStreet(s: HandState): HandState {
  // 올인 금액이 달라 콜받지 못한 차액은 돌려준다
  const [c0, c1] = s.committed
  if (c0 !== c1) {
    const big: PlayerId = c0 > c1 ? 0 : 1
    const refund = chips(Math.abs(c0 - c1))
    s.committed[big] = chips(s.committed[big] - refund)
    s.stacks[big] = chips(s.stacks[big] + refund)
  }
  s.pot = totalPot(s)
  s.committed = [0, 0]
  s.acted = [false, false]
  s.lastRaise = BIG_BLIND

  const someoneAllIn = s.stacks[0] === 0 || s.stacks[1] === 0
  if (s.street === 'river' || someoneAllIn) {
    while (s.board.length < 5) s.board.push(s.deck.pop()!)
    if (s.board.length === 5 && s.street !== 'river') s.street = 'river'
    return showdown(s)
  }

  if (s.street === 'preflop') {
    s.board.push(s.deck.pop()!, s.deck.pop()!, s.deck.pop()!)
    s.street = 'flop'
  } else {
    s.board.push(s.deck.pop()!)
    s.street = s.street === 'flop' ? 'turn' : 'river'
  }
  // 플랍 이후에는 빅블라인드(버튼이 아닌 쪽)가 먼저 행동한다
  s.toAct = other(s.button)
  return advance(s, s.button)
}

function showdown(s: HandState): HandState {
  const scores: [number, number] = [evaluate([...s.holes[0], ...s.board]), evaluate([...s.holes[1], ...s.board])]
  const pot = s.pot
  const payouts: [number, number] = [0, 0]
  let winners: PlayerId[]
  if (scores[0] === scores[1]) {
    winners = [0, 1]
    const half = chips(pot / 2)
    payouts[0] = half
    payouts[1] = chips(pot - half)
  } else {
    const w: PlayerId = scores[0] > scores[1] ? 0 : 1
    winners = [w]
    payouts[w] = pot
  }
  s.stacks = [chips(s.stacks[0] + payouts[0]), chips(s.stacks[1] + payouts[1])]
  s.pot = 0
  s.result = { winners, payouts, showdown: true, scores }
  s.toAct = null
  return s
}

/** 이번 핸드에서 각자의 손익 */
export function netResult(s: HandState): [number, number] {
  return [chips(s.stacks[0] - s.startStacks[0]), chips(s.stacks[1] - s.startStacks[1])]
}
