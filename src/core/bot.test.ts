// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseCards } from './cards'
import { BOT_PROFILES, botDecision, estimateRangePct, preflopSituation } from './bot'
import { coachDecision, type CoachRequest } from './coach'
import type { Combo } from './equity'
import { applyAction, legalActions, newHand, type Action, type HandState, type PlayerId } from './game'
import { chenScore, classPercentile, sampleEquity, topCombos } from './handRank'
import { seededRandom } from './random'

const combo = (t: string): Combo => {
  const [a, b] = parseCards(t)
  return [a, b]
}

describe('프리플랍 핸드 순위', () => {
  it('Chen 점수: AA 20, AKs 12, 72o 는 낮다', () => {
    expect(chenScore('AA')).toBe(20)
    expect(chenScore('AKs')).toBe(12)
    expect(chenScore('72o')).toBeLessThan(0)
  })

  it('AA는 최상위, 72o는 최하위권', () => {
    expect(classPercentile('AA')).toBeLessThan(0.01)
    expect(classPercentile('72o')).toBeGreaterThan(0.9)
    expect(classPercentile('AKs')).toBeLessThan(classPercentile('KQo'))
  })

  it('상위 % 콤보는 비율에 맞게 늘어난다', () => {
    expect(topCombos(0.1).length).toBeLessThan(topCombos(0.5).length)
    expect(topCombos(1)).toHaveLength(1326)
  })

  it('샘플 에퀴티: AA vs 랜덤 약 85%', () => {
    const eq = sampleEquity(combo('As Ah'), [], topCombos(1), 4000, seededRandom(3))
    expect(eq).toBeGreaterThan(0.82)
    expect(eq).toBeLessThan(0.88)
  })
})

/** AI끼리 여러 판을 두게 해서 항상 합법적인 행동만 하는지 확인 */
function selfPlay(profileA: keyof typeof BOT_PROFILES, profileB: keyof typeof BOT_PROFILES, hands: number) {
  const random = seededRandom(11)
  const profiles = [BOT_PROFILES[profileA], BOT_PROFILES[profileB]]
  const net = [0, 0]
  for (let h = 0; h < hands; h++) {
    let s = newHand([100, 100], (h % 2) as PlayerId, random)
    while (s.toAct !== null) {
      const me = s.toAct
      s = applyAction(s, me, botDecision(s, me, profiles[me], random))
    }
    net[0] += s.stacks[0] - 100
    net[1] += s.stacks[1] - 100
  }
  return net
}

describe('AI 상대', () => {
  it('AI끼리 200판을 두어도 항상 합법적인 행동을 한다', () => {
    const net = selfPlay('tag', 'lag', 200)
    expect(net[0] + net[1]).toBeCloseTo(0, 6)
  })

  it('모든 성향이 오류 없이 동작한다', () => {
    expect(() => selfPlay('station', 'nit', 100)).not.toThrow()
  })

  it('AA는 먼저 행동할 때 레이즈한다', () => {
    let s = newHand([100, 100], 1, seededRandom(5))
    s = { ...s, holes: [s.holes[0], combo('As Ah')] }
    expect(botDecision(s, 1, BOT_PROFILES.nit, seededRandom(1)).type).toBe('raise')
  })

  it('니트는 72o를 폴드한다', () => {
    let s = newHand([100, 100], 1, seededRandom(5))
    s = { ...s, holes: [s.holes[0], combo('7c 2d')] }
    expect(botDecision(s, 1, BOT_PROFILES.nit, seededRandom(1)).type).toBe('fold')
  })

  it('프리플랍 상황과 레인지 폭을 추정한다', () => {
    let s = newHand([100, 100], 0, seededRandom(5))
    expect(preflopSituation(s, 0)).toBe('first')
    s = applyAction(s, 0, { type: 'raise', to: 2.5 })
    expect(preflopSituation(s, 1)).toBe('vsOpen')
    s = applyAction(s, 1, { type: 'raise', to: 9 })
    expect(preflopSituation(s, 0)).toBe('vs3bet')
    const p = BOT_PROFILES.tag
    expect(estimateRangePct(s.log, 0, 0, p)).toBe(p.open)
    expect(estimateRangePct(s.log, 1, 0, p)).toBe(p.threeBet)
  })
})

describe('코치', () => {
  const base = (patch: Partial<CoachRequest>): CoachRequest => ({
    street: 'preflop',
    hole: combo('As Ah'),
    board: [],
    pot: 1.5,
    toCall: 0.5,
    currentBet: 1,
    canRaise: true,
    heroStack: 99.5,
    villainStack: 99,
    situation: 'first',
    inPosition: false,
    villainPct: 1,
    villainStyle: 'balanced',
    action: { type: 'raise', to: 2.5 },
    ...patch,
  })

  it('AA로 오픈 레이즈는 좋은 선택', () => {
    expect(coachDecision(base({})).verdict).toBe('good')
  })

  it('AA를 폴드하면 실수', () => {
    expect(coachDecision(base({ action: { type: 'fold' } })).verdict).toBe('mistake')
  })

  it('72o로 큰 3벳에 콜하면 실수', () => {
    const f = coachDecision(
      base({ hole: combo('7c 2d'), situation: 'vs3bet', toCall: 7, currentBet: 9, action: { type: 'call' } }),
    )
    expect(f.verdict).toBe('mistake')
    expect(f.recommended).toBe('폴드')
  })

  it('포스트플랍: 넛을 들고 베팅받았을 때 폴드하면 큰 손실', () => {
    const f = coachDecision(
      base({
        street: 'river',
        hole: combo('Ah Qh'),
        board: parseCards('Kh 7h 2h 3c 9d'),
        pot: 15,
        toCall: 5,
        currentBet: 5,
        situation: null,
        villainPct: 0.6,
        action: { type: 'fold' },
      }),
    )
    expect(f.verdict).toBe('mistake')
    expect(f.evLoss).toBeGreaterThan(10)
  })

  it('포스트플랍: 베팅이 없을 때 기대값 비교 결과를 준다', () => {
    const f = coachDecision(
      base({
        street: 'flop',
        hole: combo('7c 7d'),
        board: parseCards('Kh 7h 2s'),
        pot: 5,
        toCall: 0,
        currentBet: 0,
        situation: null,
        villainPct: 0.6,
        action: { type: 'check' },
      }),
    )
    expect(f.evLoss).not.toBeNull()
    expect(f.recommended).toContain('베팅')
  })
})

describe('게임 + AI 흐름', () => {
  it('사람(0) 대 AI(1)로 한 판을 끝까지 진행할 수 있다', () => {
    const random = seededRandom(21)
    let s: HandState = newHand([100, 100], 0, random)
    while (s.toAct !== null) {
      const me = s.toAct
      const a: Action =
        me === 1 ? botDecision(s, 1, BOT_PROFILES.tag, random) : legalActions(s).canCheck ? { type: 'check' } : { type: 'call' }
      s = applyAction(s, me, a)
    }
    expect(s.result).not.toBeNull()
  })
})
