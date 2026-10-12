// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseCards } from './cards'
import type { Combo } from './equity'
import { parseRange, rangeCombos } from './range'
import { postflopAdvice, type PostflopInput } from './sizing'

const combo = (t: string): Combo => {
  const [a, b] = parseCards(t)
  return [a, b]
}

const advise = (hero: string, board: string, extra: Partial<PostflopInput> = {}) =>
  postflopAdvice({
    hero: combo(hero),
    board: parseCards(board),
    pot: 10,
    stack: 100,
    villain: rangeCombos(parseRange('22+, A2s+, K9s+, QTs+, JTs, T9s, 98s, ATo+, KJo+')),
    style: 'balanced',
    ...extra,
  })

describe('포스트플랍 사이즈 추천', () => {
  it('셋(강한 밸류)은 베팅을 추천한다', () => {
    const r = advise('7c 7d', 'Kh 7h 2s')
    expect(r.strength).toBe('strong')
    expect(r.best.kind).not.toBe('check')
    expect(r.best.ev).toBeGreaterThan(r.options[0].ev)
  })

  it('넛 핸드는 리버에서 상대가 콜할 때 항상 이긴다', () => {
    const r = advise('Ah Qh', 'Kh 7h 2h 3c 9d')
    expect(r.equity).toBe(1)
    for (const o of r.options.filter((x) => x.kind !== 'check')) expect(o.equityWhenCalled).toBe(1)
  })

  it('베팅이 클수록 상대 폴드율이 높아진다', () => {
    const r = advise('7c 7d', 'Kh 7h 2s')
    const bets = r.options.filter((o) => o.kind !== 'check')
    for (let i = 1; i < bets.length; i++) expect(bets[i].foldRate).toBeGreaterThanOrEqual(bets[i - 1].foldRate)
  })

  it('콜이 많은 상대에게 약한 핸드로는 블러프하지 않는다', () => {
    const r = advise('4c 3d', 'Kh Qh 9s 8c 2d', { style: 'station' })
    expect(r.strength).toBe('weak')
    expect(r.best.kind).toBe('check')
  })

  it('콜이 많은 상대에게는 폴드가 많은 상대보다 폴드율이 낮다', () => {
    const station = advise('Ac Kd', 'Kh 7h 2s', { style: 'station' })
    const tight = advise('Ac Kd', 'Kh 7h 2s', { style: 'tight' })
    expect(station.options[3].foldRate).toBeLessThan(tight.options[3].foldRate)
  })

  it('스택보다 큰 후보는 빼고 올인으로 대신한다', () => {
    const r = advise('7c 7d', 'Kh 7h 2s', { pot: 20, stack: 15 })
    const kinds = r.options.map((o) => o.kind)
    expect(kinds[kinds.length - 1]).toBe('allin')
    expect(r.options.every((o) => o.bet <= 15)).toBe(true)
    expect(r.spr).toBeCloseTo(0.75)
  })

  it('SPR이 높으면 올인은 후보에서 빠지고, 낮으면 들어간다', () => {
    expect(advise('7c 7d', 'Kh 7h 2s', { pot: 10, stack: 100 }).options.some((o) => o.kind === 'allin')).toBe(false)
    expect(advise('7c 7d', 'Kh 7h 2s', { pot: 10, stack: 30 }).options.some((o) => o.kind === 'allin')).toBe(true)
  })

  it('폴드가 많은 상대에게는 약한 핸드로 블러프하는 쪽이 낫다', () => {
    const r = advise('Qc Jc', 'Kh 7h 2s', { style: 'tight' })
    expect(r.best.kind).toBe('bet')
  })

  it('랜덤 상대도 계산한다 (턴)', () => {
    const r = advise('Ah Kh', 'Qh Jh 2c 3d', { villain: null })
    expect(r.combos).toBe(1035) // 남은 46장에서 2장 = C(46,2)
    expect(r.draws.labels).toContain('플러시 드로우')
  })

  it('입력 검사', () => {
    expect(() => advise('Ah Kh', 'Qh Jh')).toThrow()
    expect(() => advise('Ah Kh', 'Ah Jh 2c')).toThrow('중복')
    expect(() => advise('Ah Kh', 'Qh Jh 2c', { pot: 0 })).toThrow()
  })
})
