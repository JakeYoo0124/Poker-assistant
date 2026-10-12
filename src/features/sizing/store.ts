import { create } from 'zustand'
import type { Card } from '../../core/cards'
import type { GameStyle, Position } from '../../core/preflopSizing'
import type { VillainStyle } from '../../core/sizing'

export type SizingTab = 'postflop' | 'preflop'
export type PreflopKind = 'open' | '3bet' | '4bet'

/** 슬롯 0~1 = 내 핸드, 2~6 = 보드 */
export const SLOT_COUNT = 7

interface SizingState {
  tab: SizingTab

  // 포스트플랍
  cards: (Card | null)[]
  active: number | null
  pot: number
  stack: number
  /** null = 랜덤 핸드 */
  villainRangeId: string | null
  villainStyle: VillainStyle

  // 프리플랍
  preflopKind: PreflopKind
  position: Position
  limpers: number
  gameStyle: GameStyle
  preflopStack: number
  openSize: number
  callers: number
  threeBetSize: number
  inPosition: boolean

  set: (patch: Partial<Omit<SizingState, 'set' | 'pick' | 'clearActive' | 'resetCards'>>) => void
  pick: (card: Card) => void
  clearActive: () => void
  resetCards: () => void
}

export const useSizingStore = create<SizingState>((set, get) => ({
  tab: 'postflop',

  cards: Array(SLOT_COUNT).fill(null),
  active: 0,
  pot: 6,
  stack: 97,
  villainRangeId: null,
  villainStyle: 'balanced',

  preflopKind: 'open',
  position: 'BTN',
  limpers: 0,
  gameStyle: 'online',
  preflopStack: 100,
  openSize: 2.5,
  callers: 0,
  threeBetSize: 9,
  inPosition: true,

  set: (patch) => set(patch),

  pick: (card) => {
    const { cards, active } = get()
    if (active === null) return
    if (cards.includes(card) && cards[active] !== card) return
    const next = [...cards]
    next[active] = card
    let nextActive: number | null = null
    for (let i = active + 1; i < SLOT_COUNT; i++) {
      if (next[i] === null) {
        nextActive = i
        break
      }
    }
    set({ cards: next, active: nextActive })
  },

  clearActive: () => {
    const { cards, active } = get()
    if (active === null) return
    const next = [...cards]
    next[active] = null
    set({ cards: next })
  },

  resetCards: () => set({ cards: Array(SLOT_COUNT).fill(null), active: 0 }),
}))
