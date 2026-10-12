// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { TOTAL_COMBOS, countCombos } from '../../core/range'
import { defaultCharts, playableClasses } from './model'

describe('기본 레인지', () => {
  it('포지션이 늦을수록 넓어진다 (UTG < HJ < CO < BTN)', () => {
    const [utg, hj, co, btn] = defaultCharts().map((c) => countCombos(playableClasses(c)) / TOTAL_COMBOS)
    expect(utg).toBeGreaterThan(0.12)
    expect(utg).toBeLessThan(hj)
    expect(hj).toBeLessThan(co)
    expect(co).toBeLessThan(btn)
    expect(btn).toBeLessThan(0.5)
  })
})
