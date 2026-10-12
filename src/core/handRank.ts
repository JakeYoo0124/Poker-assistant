/**
 * 프리플랍 핸드 순위
 *
 * 169개 클래스를 Chen 공식 점수로 줄 세우고, 콤보 수로 가중한 "상위 몇 %" 값을 매긴다.
 * (Chen 공식: 빌 첸이 만든 간단한 프리플랍 핸드 점수. 정확한 에퀴티 순위와 조금 다르지만 계산이 즉시 끝난다.)
 */

import { DECK_SIZE, RANK_CHARS, shuffle, type Card } from './cards'
import type { Combo } from './equity'
import { evaluate } from './evaluator'
import { ALL_CLASSES, TOTAL_COMBOS, classCombos, classOfCombo, comboCountOf, type HandClass } from './range'

const HIGH_CARD_POINTS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 10] // 2 ~ A

export function chenScore(cls: HandClass): number {
  const high = RANK_CHARS.indexOf(cls[0])
  const low = RANK_CHARS.indexOf(cls[1])
  let score = HIGH_CARD_POINTS[high]
  if (high === low) return Math.max(5, score * 2)

  if (cls[2] === 's') score += 2
  const gap = high - low - 1
  score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5
  // 둘 다 Q보다 낮은 커넥터·1갭은 스트레이트 가능성이 높아 가산점
  if (gap <= 1 && high < RANK_CHARS.indexOf('Q')) score += 1
  return Math.ceil(score)
}

/** 클래스별 "상위 몇 %" (0에 가까울수록 강함). 같은 점수끼리는 중간값을 준다. */
const PERCENTILE: ReadonlyMap<HandClass, number> = (() => {
  const sorted = [...ALL_CLASSES].sort((a, b) => chenScore(b) - chenScore(a))
  const map = new Map<HandClass, number>()
  let i = 0
  let above = 0
  while (i < sorted.length) {
    const score = chenScore(sorted[i])
    let j = i
    let group = 0
    while (j < sorted.length && chenScore(sorted[j]) === score) group += comboCountOf(sorted[j++])
    for (let k = i; k < j; k++) map.set(sorted[k], (above + group / 2) / TOTAL_COMBOS)
    above += group
    i = j
  }
  return map
})()

export function classPercentile(cls: HandClass): number {
  return PERCENTILE.get(cls)!
}

export function comboPercentile(combo: Combo): number {
  return classPercentile(classOfCombo(combo))
}

/** 상위 pct(0~1) 안에 드는 클래스 */
export function topClasses(pct: number): HandClass[] {
  return ALL_CLASSES.filter((c) => PERCENTILE.get(c)! <= pct)
}

/** 상위 pct 안에 드는 실제 콤보 (사용된 카드와 겹치는 콤보는 제외) */
export function topCombos(pct: number, dead: readonly Card[] = []): Combo[] {
  const used = new Set(dead)
  const out: Combo[] = []
  for (const cls of topClasses(pct)) {
    for (const c of classCombos(cls)) if (!used.has(c[0]) && !used.has(c[1])) out.push(c)
  }
  return out
}

/**
 * 몬테카를로로 내 에퀴티를 추정한다. 상대 핸드는 combos 중에서 고른다.
 * 게임 중 AI 판단처럼 빨라야 하는 곳에 쓴다 (수백 번 샘플이면 충분).
 */
export function sampleEquity(
  hole: Combo,
  board: readonly Card[],
  combos: readonly Combo[],
  samples: number,
  random: () => number,
): number {
  const dead = new Set<Card>([...hole, ...board])
  const usable = combos.filter(([a, b]) => !dead.has(a) && !dead.has(b))
  if (usable.length === 0) return 0.5

  const deck: Card[] = []
  for (let c = 0; c < DECK_SIZE; c++) if (!dead.has(c)) deck.push(c)
  const missing = 5 - board.length
  const mine: Card[] = [hole[0], hole[1], ...board]
  const theirs: Card[] = [0, 0, ...board]

  let won = 0
  for (let i = 0; i < samples; i++) {
    const [a, b] = usable[Math.floor(random() * usable.length)]
    theirs[0] = a
    theirs[1] = b
    mine.length = 2 + board.length
    theirs.length = 2 + board.length
    // 남은 덱에서 상대 카드를 빼고 보드를 채운다
    const rest = deck.filter((c) => c !== a && c !== b)
    shuffle(rest, random)
    for (let j = 0; j < missing; j++) {
      mine.push(rest[j])
      theirs.push(rest[j])
    }
    const d = evaluate(mine) - evaluate(theirs)
    won += d > 0 ? 1 : d === 0 ? 0.5 : 0
  }
  return won / samples
}
