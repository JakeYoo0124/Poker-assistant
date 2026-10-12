/**
 * 핸드 족보 판정기 (5~7장)
 *
 * 결과는 "점수" 정수 하나이며, 점수가 클수록 강한 핸드다.
 *   score = category << 20 | r1 << 16 | r2 << 12 | r3 << 8 | r4 << 4 | r5
 * category는 HandCategory, r1~r5는 승부를 가르는 랭크(중요한 순서)다.
 * 같은 점수 = 무승부, 즉 숫자 비교만으로 승패를 결정할 수 있다.
 *
 * 에퀴티 계산에서 수백만 번 호출되므로 할당을 피하고 비트 연산을 쓴다.
 */

import { ACE, rankToChar, type Card, type Rank } from './cards'

export const HandCategory = {
  HighCard: 0,
  OnePair: 1,
  TwoPair: 2,
  ThreeOfAKind: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  FourOfAKind: 7,
  StraightFlush: 8,
} as const
export type HandCategory = (typeof HandCategory)[keyof typeof HandCategory]

export const CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: '하이카드',
  [HandCategory.OnePair]: '원페어',
  [HandCategory.TwoPair]: '투페어',
  [HandCategory.ThreeOfAKind]: '트리플',
  [HandCategory.Straight]: '스트레이트',
  [HandCategory.Flush]: '플러시',
  [HandCategory.FullHouse]: '풀하우스',
  [HandCategory.FourOfAKind]: '포카드',
  [HandCategory.StraightFlush]: '스트레이트 플러시',
}

const CATEGORY_SHIFT = 20

// 판정 중 재사용하는 작업 공간 (단일 스레드에서만 호출되므로 안전)
const rankCounts = new Uint8Array(13)
const suitCounts = new Uint8Array(4)
const suitMasks = new Uint16Array(4)

/**
 * 랭크 비트마스크에서 스트레이트의 가장 높은 랭크를 찾는다. 없으면 -1.
 * A-2-3-4-5(휠)는 5 하이(랭크 3)로 취급한다.
 */
function straightHigh(mask: number): Rank {
  // 비트 0에 로우 에이스를 추가: 비트 i+1 = 랭크 i
  const m = (mask << 1) | ((mask >> ACE) & 1)
  for (let top = 13; top >= 4; top--) {
    if (((m >> (top - 4)) & 0x1f) === 0x1f) return top - 1
  }
  return -1
}

/** 마스크에서 높은 랭크부터 k개를 4비트씩 이어 붙인다. */
function topRanks(mask: number, k: number): number {
  let out = 0
  let n = 0
  for (let r = ACE; r >= 0 && n < k; r--) {
    if (mask & (1 << r)) {
      out = (out << 4) | r
      n++
    }
  }
  return out
}

function make(category: HandCategory, packedRanks: number, rankCount: number): number {
  return (category << CATEGORY_SHIFT) | (packedRanks << (4 * (5 - rankCount)))
}

/** 5~7장의 카드에서 만들 수 있는 가장 좋은 5장 핸드의 점수 */
export function evaluate(cards: readonly Card[]): number {
  const n = cards.length
  if (n < 5 || n > 7) throw new Error(`판정에는 5~7장이 필요합니다 (받은 카드: ${n}장)`)

  rankCounts.fill(0)
  suitCounts.fill(0)
  suitMasks.fill(0)
  let rankMask = 0

  for (let i = 0; i < n; i++) {
    const c = cards[i]
    const r = c >> 2
    const s = c & 3
    rankCounts[r]++
    suitCounts[s]++
    suitMasks[s] |= 1 << r
    rankMask |= 1 << r
  }

  // 플러시 / 스트레이트 플러시
  // 7장 이하에서 플러시가 있으면 포카드·풀하우스는 동시에 성립할 수 없으므로 바로 반환한다.
  for (let s = 0; s < 4; s++) {
    if (suitCounts[s] >= 5) {
      const fm = suitMasks[s]
      const sh = straightHigh(fm)
      if (sh >= 0) return make(HandCategory.StraightFlush, sh, 1)
      return make(HandCategory.Flush, topRanks(fm, 5), 5)
    }
  }

  let quad = -1
  let trip1 = -1
  let trip2 = -1
  let pair1 = -1
  let pair2 = -1
  for (let r = ACE; r >= 0; r--) {
    const cnt = rankCounts[r]
    if (cnt === 4) quad = r
    else if (cnt === 3) {
      if (trip1 < 0) trip1 = r
      else if (trip2 < 0) trip2 = r
    } else if (cnt === 2) {
      if (pair1 < 0) pair1 = r
      else if (pair2 < 0) pair2 = r
    }
  }

  if (quad >= 0) {
    const kicker = topRanks(rankMask & ~(1 << quad), 1)
    return make(HandCategory.FourOfAKind, (quad << 4) | kicker, 2)
  }

  if (trip1 >= 0 && (trip2 >= 0 || pair1 >= 0)) {
    const full = Math.max(trip2, pair1)
    return make(HandCategory.FullHouse, (trip1 << 4) | full, 2)
  }

  const sh = straightHigh(rankMask)
  if (sh >= 0) return make(HandCategory.Straight, sh, 1)

  if (trip1 >= 0) {
    const kickers = topRanks(rankMask & ~(1 << trip1), 2)
    return make(HandCategory.ThreeOfAKind, (trip1 << 8) | kickers, 3)
  }

  if (pair2 >= 0) {
    const kicker = topRanks(rankMask & ~(1 << pair1) & ~(1 << pair2), 1)
    return make(HandCategory.TwoPair, (pair1 << 8) | (pair2 << 4) | kicker, 3)
  }

  if (pair1 >= 0) {
    const kickers = topRanks(rankMask & ~(1 << pair1), 3)
    return make(HandCategory.OnePair, (pair1 << 12) | kickers, 4)
  }

  return make(HandCategory.HighCard, topRanks(rankMask, 5), 5)
}

export function categoryOf(score: number): HandCategory {
  return (score >> CATEGORY_SHIFT) as HandCategory
}

/** 점수에 담긴 랭크들 (중요한 순서, 최대 5개) */
export function ranksOf(score: number): Rank[] {
  const counts: Record<HandCategory, number> = {
    [HandCategory.HighCard]: 5,
    [HandCategory.OnePair]: 4,
    [HandCategory.TwoPair]: 3,
    [HandCategory.ThreeOfAKind]: 3,
    [HandCategory.Straight]: 1,
    [HandCategory.Flush]: 5,
    [HandCategory.FullHouse]: 2,
    [HandCategory.FourOfAKind]: 2,
    [HandCategory.StraightFlush]: 1,
  }
  const k = counts[categoryOf(score)]
  const ranks: Rank[] = []
  for (let i = 0; i < k; i++) ranks.push((score >> (16 - 4 * i)) & 0xf)
  return ranks
}

/** a가 이기면 양수, 지면 음수, 비기면 0 */
export function compareScores(a: number, b: number): number {
  return a - b
}

export interface HandDescription {
  category: HandCategory
  /** 예: "풀하우스" */
  name: string
  /** 예: "K 풀 오브 7" */
  detail: string
}

export function describeScore(score: number): HandDescription {
  const category = categoryOf(score)
  const ranks = ranksOf(score)
  const ch = ranks.map(rankToChar)

  let name = CATEGORY_NAMES[category]
  let detail: string
  switch (category) {
    case HandCategory.StraightFlush:
      if (ranks[0] === ACE) {
        name = '로열 플러시'
        detail = 'A 하이'
      } else {
        detail = `${ch[0]} 하이`
      }
      break
    case HandCategory.FourOfAKind:
      detail = `${ch[0]} 포카드, 키커 ${ch[1]}`
      break
    case HandCategory.FullHouse:
      detail = `${ch[0]} 풀 오브 ${ch[1]}`
      break
    case HandCategory.Flush:
      detail = `${ch[0]} 하이 (${ch.join('')})`
      break
    case HandCategory.Straight:
      detail = `${ch[0]} 하이`
      break
    case HandCategory.ThreeOfAKind:
      detail = `${ch[0]} 트리플, 키커 ${ch.slice(1).join('')}`
      break
    case HandCategory.TwoPair:
      detail = `${ch[0]}·${ch[1]} 투페어, 키커 ${ch[2]}`
      break
    case HandCategory.OnePair:
      detail = `${ch[0]} 페어, 키커 ${ch.slice(1).join('')}`
      break
    default:
      detail = ch.join('')
  }
  return { category, name, detail }
}

/**
 * 5~7장 중 가장 좋은 5장을 실제 카드로 돌려준다 (화면 표시용).
 * 21가지 조합을 모두 확인하므로 계산 루프에서는 evaluate()를 쓸 것.
 */
export function bestFiveCards(cards: readonly Card[]): { score: number; cards: Card[] } {
  const n = cards.length
  if (n < 5 || n > 7) throw new Error(`판정에는 5~7장이 필요합니다 (받은 카드: ${n}장)`)

  let bestScore = -1
  let best: Card[] = []
  const pick: Card[] = new Array(5)

  const choose = (start: number, depth: number) => {
    if (depth === 5) {
      const score = evaluate(pick)
      if (score > bestScore) {
        bestScore = score
        best = pick.slice()
      }
      return
    }
    for (let i = start; i <= n - (5 - depth); i++) {
      pick[depth] = cards[i]
      choose(i + 1, depth + 1)
    }
  }
  choose(0, 0)

  return { score: bestScore, cards: best }
}
