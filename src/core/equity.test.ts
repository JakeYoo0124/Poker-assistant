// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cardsToString, parseCards } from './cards'
import {
  EXACT_LIMIT,
  MonteCarloEquity,
  allCombos,
  calculateExact,
  calculateOuts,
  choose,
  exactWork,
  type Combo,
  type EquityRequest,
  type PlayerRange,
} from './equity'
import { HandCategory } from './evaluator'
import { seededRandom } from './random'

const combo = (text: string): Combo => {
  const [a, b] = parseCards(text)
  return [a, b]
}
const hand = (text: string): PlayerRange => ({ kind: 'combos', combos: [combo(text)] })
const random: PlayerRange = { kind: 'random' }
const req = (players: PlayerRange[], board = ''): EquityRequest => ({ players, board: parseCards(board) })

const monteCarlo = (r: EquityRequest, iterations: number, seed = 1) => {
  const mc = new MonteCarloEquity(r, seededRandom(seed))
  mc.run(iterations)
  return mc.result()
}

describe('보조 함수', () => {
  it('조합 수를 계산한다', () => {
    expect(choose(52, 5)).toBe(2_598_960)
    expect(choose(48, 5)).toBe(1_712_304)
    expect(choose(5, 0)).toBe(1)
    expect(choose(3, 5)).toBe(0)
  })

  it('홀카드 조합은 1326개이고, 사용된 카드를 빼면 줄어든다', () => {
    expect(allCombos()).toHaveLength(1326)
    expect(allCombos(parseCards('As Kd'))).toHaveLength(choose(50, 2))
  })
})

describe('정확 계산', () => {
  it('리버에서는 승패가 확정된다', () => {
    const r = calculateExact(req([hand('As Ah'), hand('Kc Kd')], '2c 7d 9h Js 3c'))
    expect(r.exact).toBe(true)
    expect(r.samples).toBe(1)
    expect(r.players[0]).toEqual({ equity: 1, win: 1, tie: 0 })
    expect(r.players[1]).toEqual({ equity: 0, win: 0, tie: 0 })
  })

  it('둘 다 보드를 쓰면 반씩 나눈다', () => {
    const r = calculateExact(req([hand('2c 3d'), hand('4c 5d')], 'As Ks Qs Js Ts'))
    expect(r.players[0]).toEqual({ equity: 0.5, win: 0, tie: 1 })
    expect(r.players[1]).toEqual({ equity: 0.5, win: 0, tie: 1 })
  })

  it('턴에서 아웃츠 수만큼 에퀴티가 나온다', () => {
    // AhKh vs QcQd, 보드 2h 7h 9c Js → 하트 9장 + A 3장 + K 3장 = 15 아웃 / 44장
    const r = calculateExact(req([hand('Ah Kh'), hand('Qc Qd')], '2h 7h 9c Js'))
    expect(r.samples).toBe(44)
    expect(r.players[0].equity).toBeCloseTo(15 / 44, 10)
    expect(r.players[1].equity).toBeCloseTo(29 / 44, 10)
  })

  it('프리플랍 QQ vs AKs는 약 54 : 46이다', () => {
    const r = calculateExact(req([hand('Qc Qd'), hand('Ah Kh')]))
    expect(r.samples).toBe(choose(48, 5))
    expect(r.players[0].equity).toBeGreaterThan(0.53)
    expect(r.players[0].equity).toBeLessThan(0.55)
    expect(r.players[0].equity + r.players[1].equity).toBeCloseTo(1, 10)
  })

  it('랜덤 상대도 열거한다 (플랍)', () => {
    const r = calculateExact(req([hand('As Ad'), random], 'Ac 7d 2h'))
    expect(r.samples).toBe(choose(47, 2) * choose(45, 2))
    expect(r.players[0].equity).toBeGreaterThan(0.95)
  })

  it('히어로의 완성 족보 분포 합은 1이다', () => {
    const r = calculateExact(req([hand('Ah Kh'), hand('Qc Qd')], '2h 7h 9c'))
    const sum = r.heroCategories.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 10)
    expect(r.heroCategories[HandCategory.Flush]).toBeGreaterThan(0.3)
  })

  it('레인지 조합 중 다른 플레이어와 겹치는 조합은 건너뛴다', () => {
    // 상대 레인지 {AsAh, KsKh} 중 AsAh는 히어로의 As와 겹친다
    const r = calculateExact(
      req([hand('As Qd'), { kind: 'combos', combos: [combo('As Ah'), combo('Ks Kh')] }], '2c 3d 4h 8s 9c'),
    )
    expect(r.samples).toBe(1)
    expect(r.players[1].equity).toBe(1)
  })
})

describe('입력 검사', () => {
  it('보드가 1~2장이면 오류', () => {
    expect(() => calculateExact(req([hand('As Ah'), random], '2c 3d'))).toThrow('보드')
  })

  it('카드가 겹치면 오류', () => {
    expect(() => calculateExact(req([hand('As Ah'), hand('As Kd')]))).toThrow('중복')
    expect(() => calculateExact(req([hand('As Ah'), random], 'As 2c 3d'))).toThrow('중복')
  })

  it('플레이어가 1명이면 오류', () => {
    expect(() => calculateExact(req([hand('As Ah')]))).toThrow()
  })
})

describe('몬테카를로', () => {
  it('정확 계산과 1% 이내로 일치한다 (QQ vs AKs)', () => {
    const r = req([hand('Qc Qd'), hand('Ah Kh')])
    const exact = calculateExact(r)
    const mc = monteCarlo(r, 200_000)
    expect(mc.exact).toBe(false)
    expect(mc.samples).toBe(200_000)
    expect(Math.abs(mc.players[0].equity - exact.players[0].equity)).toBeLessThan(0.01)
  })

  it('AA vs 랜덤 1명은 약 85%다', () => {
    const r = monteCarlo(req([hand('As Ah'), random]), 200_000)
    expect(r.players[0].equity).toBeGreaterThan(0.84)
    expect(r.players[0].equity).toBeLessThan(0.862)
  })

  it('AA vs 랜덤 4명은 약 56%다', () => {
    const r = monteCarlo(req([hand('As Ah'), random, random, random, random]), 200_000)
    expect(r.players[0].equity).toBeGreaterThan(0.54)
    expect(r.players[0].equity).toBeLessThan(0.58)
    const total = r.players.reduce((a, p) => a + p.equity, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('레인지 상대와 랜덤 상대를 섞어도 동작한다', () => {
    const range: PlayerRange = { kind: 'combos', combos: [combo('Ks Kh'), combo('Qs Qh'), combo('Ac Kc')] }
    const r = monteCarlo(req([hand('As Ah'), range, random]), 50_000)
    expect(r.samples).toBe(50_000)
    expect(r.players[0].equity).toBeGreaterThan(0.6)
  })

  it('나눠서 실행해도 횟수가 누적된다', () => {
    const mc = new MonteCarloEquity(req([hand('As Ah'), random]), seededRandom(7))
    mc.run(1000)
    mc.run(2000)
    expect(mc.samples).toBe(3000)
  })
})

describe('계산 방식 선택 기준', () => {
  it('헤즈업 특정 핸드 프리플랍은 정확 계산 범위다', () => {
    expect(exactWork(req([hand('Qc Qd'), hand('Ah Kh')]))).toBeLessThanOrEqual(EXACT_LIMIT)
  })

  it('랜덤 상대 프리플랍은 시뮬레이션으로 넘어간다', () => {
    expect(exactWork(req([hand('As Ah'), random]))).toBeGreaterThan(EXACT_LIMIT)
  })

  it('랜덤 상대 1명 플랍은 정확 계산 범위다', () => {
    expect(exactWork(req([hand('As Ah'), random], 'Ac 7d 2h'))).toBeLessThanOrEqual(EXACT_LIMIT)
  })
})

describe('아웃츠', () => {
  it('뒤처진 상황에서 이기게 해주는 카드를 찾는다', () => {
    const r = calculateOuts(combo('Ah Kh'), [combo('Qc Qd')], parseCards('2h 7h 9c Js'))
    expect(r.status).toBe('behind')
    expect(r.winning).toHaveLength(15)
    expect(r.remaining).toBe(44)
    expect(cardsToString(r.winning)).toContain('Ad')
    expect(cardsToString(r.winning)).toContain('Qh')
  })

  it('앞선 상황에서는 지게 만드는 카드(위험 카드)를 찾는다', () => {
    // 셋 vs 오버페어: 상대는 Q 두 장(남은 Q)만 이기는 카드
    const r = calculateOuts(combo('7c 7d'), [combo('Qc Qd')], parseCards('7h 2s 9c 3d'))
    expect(r.status).toBe('ahead')
    expect(cardsToString(r.losing).split(' ').sort()).toEqual(['Qh', 'Qs'])
  })

  it('프리플랍이나 리버에서는 오류', () => {
    expect(() => calculateOuts(combo('Ah Kh'), [combo('Qc Qd')], [])).toThrow()
  })
})
