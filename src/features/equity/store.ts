import { create } from 'zustand'
import type { Card } from '../../core/cards'

export type SlotRef =
  | { kind: 'hero'; index: number }
  | { kind: 'board'; index: number }
  | { kind: 'opp'; opp: number; index: number }

export type OpponentMode = 'random' | 'hand' | 'range'

export interface Opponent {
  id: number
  mode: OpponentMode
  cards: (Card | null)[]
  /** mode가 'range'일 때 사용할 레인지 차트 id */
  rangeId: string | null
}

export const MAX_OPPONENTS = 9

interface EquityState {
  hero: (Card | null)[]
  board: (Card | null)[]
  opponents: Opponent[]
  active: SlotRef | null
  pot: number
  call: number

  setActive: (ref: SlotRef | null) => void
  pick: (card: Card) => void
  clearActive: () => void
  addOpponent: () => void
  removeOpponent: (opp: number) => void
  /** 'range'로 바꿀 때는 rangeId를 함께 준다 */
  setOpponentMode: (opp: number, mode: OpponentMode, rangeId?: string | null) => void
  setOpponentRange: (opp: number, rangeId: string) => void
  resetAll: () => void
  resetBoard: () => void
  setPot: (pot: number) => void
  setCall: (call: number) => void
}

let nextOpponentId = 1
const newOpponent = (): Opponent => ({ id: nextOpponentId++, mode: 'random', cards: [null, null], rangeId: null })

export function sameSlot(a: SlotRef | null, b: SlotRef | null): boolean {
  if (!a || !b || a.kind !== b.kind || a.index !== b.index) return false
  return a.kind !== 'opp' || (b.kind === 'opp' && a.opp === b.opp)
}

/** 카드를 고르는 순서: 내 핸드 → 특정 핸드로 지정한 상대 → 보드 */
function slotOrder(state: Pick<EquityState, 'opponents'>): SlotRef[] {
  const refs: SlotRef[] = [
    { kind: 'hero', index: 0 },
    { kind: 'hero', index: 1 },
  ]
  state.opponents.forEach((o, opp) => {
    if (o.mode === 'hand') refs.push({ kind: 'opp', opp, index: 0 }, { kind: 'opp', opp, index: 1 })
  })
  for (let i = 0; i < 5; i++) refs.push({ kind: 'board', index: i })
  return refs
}

export function getSlot(state: Pick<EquityState, 'hero' | 'board' | 'opponents'>, ref: SlotRef): Card | null {
  if (ref.kind === 'hero') return state.hero[ref.index]
  if (ref.kind === 'board') return state.board[ref.index]
  return state.opponents[ref.opp]?.cards[ref.index] ?? null
}

/** 현재 화면에서 사용 중인 모든 카드 */
export function usedCards(state: Pick<EquityState, 'hero' | 'board' | 'opponents'>): Set<Card> {
  const used = new Set<Card>()
  const add = (c: Card | null) => c !== null && used.add(c)
  state.hero.forEach(add)
  state.board.forEach(add)
  state.opponents.forEach((o) => o.mode === 'hand' && o.cards.forEach(add))
  return used
}

function nextEmptySlot(state: EquityState, after: SlotRef | null): SlotRef | null {
  const order = slotOrder(state)
  const start = after ? order.findIndex((r) => sameSlot(r, after)) + 1 : 0
  for (let i = start; i < order.length; i++) {
    if (getSlot(state, order[i]) === null) return order[i]
  }
  return null
}

function setSlot(state: EquityState, ref: SlotRef, card: Card | null): Partial<EquityState> {
  if (ref.kind === 'hero') {
    const hero = [...state.hero]
    hero[ref.index] = card
    return { hero }
  }
  if (ref.kind === 'board') {
    const board = [...state.board]
    board[ref.index] = card
    return { board }
  }
  const opponents = state.opponents.map((o, i) => {
    if (i !== ref.opp) return o
    const cards = [...o.cards]
    cards[ref.index] = card
    return { ...o, cards }
  })
  return { opponents }
}

const initialHands = () => ({
  hero: [null, null] as (Card | null)[],
  board: [null, null, null, null, null] as (Card | null)[],
  opponents: [newOpponent()],
  active: { kind: 'hero', index: 0 } as SlotRef,
})

export const useEquityStore = create<EquityState>((set, get) => ({
  ...initialHands(),
  pot: 0,
  call: 0,

  setActive: (ref) => set({ active: ref }),

  pick: (card) => {
    const state = get()
    const { active } = state
    if (!active) return
    if (usedCards(state).has(card) && getSlot(state, active) !== card) return

    const patch = setSlot(state, active, card)
    set({ ...patch, active: nextEmptySlot({ ...state, ...patch }, active) })
  },

  clearActive: () => {
    const state = get()
    if (state.active) set(setSlot(state, state.active, null))
  },

  addOpponent: () => {
    const { opponents } = get()
    if (opponents.length >= MAX_OPPONENTS) return
    set({ opponents: [...opponents, newOpponent()] })
  },

  removeOpponent: (opp) => {
    const { opponents, active } = get()
    if (opponents.length <= 1) return
    set({
      opponents: opponents.filter((_, i) => i !== opp),
      active: active?.kind === 'opp' ? null : active,
    })
  },

  setOpponentMode: (opp, mode, rangeId = null) => {
    const state = get()
    const opponents = state.opponents.map((o, i) =>
      i === opp ? { ...o, mode, cards: [null, null], rangeId: mode === 'range' ? rangeId : null } : o,
    )
    set({
      opponents,
      active: mode === 'hand' ? { kind: 'opp', opp, index: 0 } : state.active?.kind === 'opp' ? null : state.active,
    })
  },

  setOpponentRange: (opp, rangeId) =>
    set({ opponents: get().opponents.map((o, i) => (i === opp ? { ...o, rangeId } : o)) }),

  resetAll: () => set(initialHands()),

  resetBoard: () => set({ board: [null, null, null, null, null], active: { kind: 'board', index: 0 } }),

  setPot: (pot) => set({ pot: Math.max(0, pot) }),
  setCall: (call) => set({ call: Math.max(0, call) }),
}))
