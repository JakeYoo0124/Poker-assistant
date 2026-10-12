// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { callEV, potOddsRatio, requiredEquity } from './odds'

describe('팟 오즈', () => {
  it('팟 10에 5를 콜하면 필요 승률은 1/3이다', () => {
    expect(requiredEquity(10, 5)).toBeCloseTo(1 / 3)
    expect(potOddsRatio(10, 5)).toBe(2)
  })

  it('콜 금액이 0이면 필요 승률도 0이다', () => {
    expect(requiredEquity(10, 0)).toBe(0)
    expect(potOddsRatio(10, 0)).toBe(Infinity)
  })

  it('필요 승률과 같은 에퀴티면 EV는 0이다', () => {
    expect(callEV(1 / 3, 10, 5)).toBeCloseTo(0)
    expect(callEV(0.5, 10, 5)).toBeCloseTo(2.5)
    expect(callEV(0.2, 10, 5)).toBeCloseTo(-2)
  })
})
