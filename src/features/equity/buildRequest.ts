import type { Card } from '../../core/cards'
import type { Combo, EquityRequest, PlayerRange } from '../../core/equity'
import { rangeCombos } from '../../core/range'
import { playableClasses, type RangeChart } from '../ranges/model'
import type { Opponent } from './store'

export interface BuiltRequest {
  request: EquityRequest | null
  /** 계산할 수 없는 이유 (화면 안내용) */
  message: string | null
  hero: Combo | null
  board: Card[]
  /** 모든 상대의 핸드를 알 때만 채워진다 (아웃츠 계산용) */
  knownOpponents: Combo[] | null
}

const isPair = (cards: (Card | null)[]): cards is [Card, Card] => cards[0] !== null && cards[1] !== null

export function buildRequest(
  hero: (Card | null)[],
  board: (Card | null)[],
  opponents: Opponent[],
  charts: readonly RangeChart[],
): BuiltRequest {
  const boardCards = board.filter((c): c is Card => c !== null)
  const empty: BuiltRequest = { request: null, message: null, hero: null, board: boardCards, knownOpponents: null }

  if (!isPair(hero)) return { ...empty, message: '내 핸드 2장을 골라 주세요.' }
  const heroCombo: Combo = [hero[0], hero[1]]

  if (boardCards.length === 1 || boardCards.length === 2) {
    return { ...empty, hero: heroCombo, message: '플랍은 3장을 모두 골라야 계산할 수 있어요.' }
  }

  const players: PlayerRange[] = [{ kind: 'combos', combos: [heroCombo] }]
  const known: Combo[] = []
  for (let i = 0; i < opponents.length; i++) {
    const o = opponents[i]
    const fail = (message: string) => ({ ...empty, hero: heroCombo, message })

    if (o.mode === 'random') {
      players.push({ kind: 'random' })
    } else if (o.mode === 'range') {
      const chart = charts.find((c) => c.id === o.rangeId)
      if (!chart) return fail(`상대 ${i + 1}의 레인지를 골라 주세요.`)
      const combos = rangeCombos(playableClasses(chart))
      if (combos.length === 0) return fail(`상대 ${i + 1}의 레인지 "${chart.name}"가 비어 있어요.`)
      players.push({ kind: 'combos', combos })
    } else {
      if (!isPair(o.cards)) return fail(`상대 ${i + 1}의 핸드 2장을 골라 주세요.`)
      const combo: Combo = [o.cards[0], o.cards[1]]
      players.push({ kind: 'combos', combos: [combo] })
      known.push(combo)
    }
  }

  return {
    request: { players, board: boardCards },
    message: null,
    hero: heroCombo,
    board: boardCards,
    knownOpponents: known.length === opponents.length ? known : null,
  }
}
