/**
 * 포스트플랍 베팅 사이즈 추천
 *
 * 단순화한 모델:
 *   1. 상대 레인지의 각 콤보에 대해 "내 핸드가 그 콤보를 상대로 가진 에퀴티"를 정확히 계산한다.
 *   2. 상대 콤보를 "랜덤 핸드 대비 강도"로 줄 세운다 (상대는 내 패를 모르므로).
 *   3. 상대는 베팅 B를 받으면 강한 쪽부터 일정 비율만 계속(콜)하고 나머지는 폴드한다.
 *        계속 비율 = MDF(= P / (P + B)) + 성향 보정
 *   4. 사이즈별 EV = 폴드율 × P + 콜률 × (콜당했을 때 에퀴티 × (P + 2B) − B)
 *      체크 EV   = 평균 에퀴티 × P   (체크 후 쇼다운까지 간다고 가정)
 *
 * 무시하는 것: 상대의 레이즈, 이후 스트리트의 베팅, 에퀴티 실현율. 공부용 추정치다.
 */

import { analyzeBoard, analyzeDraws, type BoardTexture, type DrawInfo } from './board'
import { DECK_SIZE, type Card } from './cards'
import { allCombos, type Combo } from './equity'
import { evaluate } from './evaluator'
import { seededRandom } from './random'

export type VillainStyle = 'balanced' | 'station' | 'tight'

export const VILLAIN_STYLE_LABELS: Record<VillainStyle, string> = {
  balanced: '밸런스 (MDF만큼 방어)',
  station: '콜이 많음',
  tight: '폴드가 많음',
}

/** MDF에 더하는 계속(콜) 비율 보정 */
export const VILLAIN_STYLE_ADJUST: Record<VillainStyle, number> = {
  balanced: 0,
  station: 0.2,
  tight: -0.15,
}

/** 팟 대비 베팅 후보 */
export const BET_FRACTIONS = [0.25, 0.33, 0.5, 0.75, 1, 1.5] as const

/** 이 SPR 이하일 때만 올인을 후보로 넣는다 */
export const ALL_IN_MAX_SPR = 3

export interface PostflopInput {
  hero: Combo
  /** 3~5장 */
  board: Card[]
  /** 내가 행동하기 전 팟 (BB) */
  pot: number
  /** 유효 스택: 베팅할 수 있는 최대 금액 (BB) */
  stack: number
  /** null이면 랜덤 핸드 */
  villain: readonly Combo[] | null
  style: VillainStyle
  /** 강도 추정용 난수 (테스트 재현용) */
  random?: () => number
}

export interface SizeOption {
  kind: 'check' | 'bet' | 'allin'
  /** 베팅 / 팟 */
  fraction: number
  /** 베팅 금액 (BB) */
  bet: number
  /** 상대 폴드 비율 (0~1) */
  foldRate: number
  /** 콜당했을 때 내 에퀴티 (0~1) */
  equityWhenCalled: number
  /** 기대값 (BB) */
  ev: number
}

export type HandStrength = 'strong' | 'medium' | 'draw' | 'showdown' | 'weak'

export const HAND_STRENGTH_LABELS: Record<HandStrength, string> = {
  strong: '강한 밸류 핸드',
  medium: '중간 강도 (얇은 밸류·보호)',
  draw: '드로우 (세미블러프 후보)',
  showdown: '쇼다운 밸류 (체크 위주)',
  weak: '약한 핸드 (블러프 후보 또는 포기)',
}

export interface PostflopAdvice {
  options: SizeOption[]
  best: SizeOption
  /** 상대 레인지 전체 대비 내 에퀴티 */
  equity: number
  spr: number
  texture: BoardTexture
  draws: DrawInfo
  strength: HandStrength
  /** 카드가 겹치지 않는 상대 콤보 수 */
  combos: number
}

const STRENGTH_SAMPLES = 150

/** 남은 보드를 모두 열거해 hero vs villain 에퀴티를 구한다 (무승부는 절반) */
function exactEquity(hero: Combo, villain: Combo, board: readonly Card[], used: Uint8Array): number {
  const h = [hero[0], hero[1], ...board, 0, 0].slice(0, 7)
  const v = [villain[0], villain[1], ...board, 0, 0].slice(0, 7)
  const missing = 5 - board.length
  if (missing === 0) {
    const d = evaluate(h) - evaluate(v)
    return d > 0 ? 1 : d === 0 ? 0.5 : 0
  }

  let total = 0
  let won = 0
  const base = 2 + board.length
  const walk = (start: number, depth: number) => {
    if (depth === missing) {
      const d = evaluate(h) - evaluate(v)
      won += d > 0 ? 1 : d === 0 ? 0.5 : 0
      total++
      return
    }
    for (let c = start; c < DECK_SIZE; c++) {
      if (used[c]) continue
      h[base + depth] = c
      v[base + depth] = c
      walk(c + 1, depth + 1)
    }
  }
  walk(0, 0)
  return won / total
}

/** 랜덤 핸드 상대로의 대략적인 강도 (몬테카를로). 상대 입장에서 본 핸드 순위용. */
function strengthVsRandom(combo: Combo, board: readonly Card[], random: () => number): number {
  const used = new Uint8Array(DECK_SIZE)
  const mine = [combo[0], combo[1], ...board]
  const opp = [0, 0, ...board]
  for (const c of mine) used[c] = 1
  const missing = 5 - board.length

  const drawn: Card[] = []
  const draw = () => {
    let c: Card
    do c = Math.floor(random() * DECK_SIZE)
    while (used[c])
    used[c] = 1
    drawn.push(c)
    return c
  }

  let won = 0
  for (let i = 0; i < STRENGTH_SAMPLES; i++) {
    drawn.length = 0
    opp[0] = draw()
    opp[1] = draw()
    mine.length = 2 + board.length
    opp.length = 2 + board.length
    for (let j = 0; j < missing; j++) {
      const c = draw()
      mine.push(c)
      opp.push(c)
    }
    const d = evaluate(mine) - evaluate(opp)
    won += d > 0 ? 1 : d === 0 ? 0.5 : 0
    for (const c of drawn) used[c] = 0
  }
  return won / STRENGTH_SAMPLES
}

export function classifyStrength(equity: number, draws: DrawInfo): HandStrength {
  if (equity >= 0.7) return 'strong'
  if (equity >= 0.5) return 'medium'
  if (draws.labels.length > 0 && equity >= 0.2) return 'draw'
  if (equity >= 0.35) return 'showdown'
  return 'weak'
}

export function postflopAdvice(input: PostflopInput): PostflopAdvice {
  const { hero, board, pot, stack, style } = input
  if (board.length < 3 || board.length > 5) throw new Error('보드는 3~5장이어야 합니다')
  if (!(pot > 0)) throw new Error('팟은 0보다 커야 합니다')
  if (!(stack > 0)) throw new Error('유효 스택은 0보다 커야 합니다')

  const dead = new Set<Card>([...hero, ...board])
  if (dead.size !== 2 + board.length) throw new Error('카드가 중복되었습니다')

  const villain = (input.villain ?? allCombos()).filter(([a, b]) => !dead.has(a) && !dead.has(b))
  if (villain.length === 0) throw new Error('카드가 겹치지 않는 상대 핸드가 없습니다')

  const random = input.random ?? seededRandom(20261012)
  const used = new Uint8Array(DECK_SIZE)
  for (const c of dead) used[c] = 1

  // 상대 콤보별: 내 에퀴티, 상대 입장의 강도
  const rows = villain.map((combo) => {
    used[combo[0]] = used[combo[1]] = 1
    const eq = exactEquity(hero, combo, board, used)
    used[combo[0]] = used[combo[1]] = 0
    return { eq, strength: strengthVsRandom(combo, board, random) }
  })
  rows.sort((a, b) => b.strength - a.strength)

  const n = rows.length
  const prefixEq = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) prefixEq[i + 1] = prefixEq[i] + rows[i].eq
  const equity = prefixEq[n] / n

  const betOption = (bet: number, kind: SizeOption['kind']): SizeOption => {
    const keep = Math.min(1, Math.max(0, pot / (pot + bet) + VILLAIN_STYLE_ADJUST[style]))
    const k = Math.round(keep * n)
    const callRate = k / n
    const equityWhenCalled = k > 0 ? prefixEq[k] / k : 0
    const ev = (1 - callRate) * pot + callRate * (equityWhenCalled * (pot + 2 * bet) - bet)
    return { kind, fraction: bet / pot, bet, foldRate: 1 - callRate, equityWhenCalled, ev }
  }

  const options: SizeOption[] = [
    { kind: 'check', fraction: 0, bet: 0, foldRate: 0, equityWhenCalled: equity, ev: equity * pot },
  ]
  let cappedByStack = false
  for (const f of BET_FRACTIONS) {
    const bet = Math.round(pot * f * 10) / 10
    if (bet < stack) options.push(betOption(bet, 'bet'))
    else cappedByStack = true
  }
  // 스택이 깊을 때의 큰 오버벳 올인은 이 단순 모델(상대가 MDF만큼 계속 방어)에서 과대평가되므로,
  // SPR이 낮거나 후보 사이즈가 스택을 넘을 때만 올인을 후보에 넣는다.
  if (stack / pot <= ALL_IN_MAX_SPR || cappedByStack) options.push(betOption(stack, 'allin'))

  // 기대값이 같으면 더 작은(앞쪽) 선택지를 고른다
  let best = options[0]
  for (const o of options) if (o.ev > best.ev + 1e-9) best = o

  const draws = analyzeDraws(hero, board)
  return {
    options,
    best,
    equity,
    spr: stack / pot,
    texture: analyzeBoard(board),
    draws,
    strength: classifyStrength(equity, draws),
    combos: n,
  }
}
