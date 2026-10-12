// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { preflopAdvice } from './preflopSizing'

describe('프리플랍 사이즈', () => {
  it('온라인 BTN 오픈은 2.5 BB', () => {
    expect(preflopAdvice({ kind: 'open', position: 'BTN', limpers: 0, style: 'online', stack: 100 })).toMatchObject({
      amount: 2.5,
      allIn: false,
    })
  })

  it('SB와 라이브는 더 크게, 림퍼 1명당 +1 BB', () => {
    expect(preflopAdvice({ kind: 'open', position: 'SB', limpers: 0, style: 'online', stack: 100 }).amount).toBe(3)
    expect(preflopAdvice({ kind: 'open', position: 'CO', limpers: 2, style: 'live', stack: 100 }).amount).toBe(5)
  })

  it('15 BB 이하에서는 올인', () => {
    expect(preflopAdvice({ kind: 'open', position: 'CO', limpers: 0, style: 'online', stack: 12 })).toMatchObject({
      amount: 12,
      allIn: true,
    })
  })

  it('3벳: 포지션 있으면 3배, 없으면 4배, 콜러마다 +1배', () => {
    expect(preflopAdvice({ kind: '3bet', openSize: 2.5, inPosition: true, callers: 0, stack: 100 }).amount).toBe(7.5)
    expect(preflopAdvice({ kind: '3bet', openSize: 2.5, inPosition: false, callers: 0, stack: 100 }).amount).toBe(10)
    expect(preflopAdvice({ kind: '3bet', openSize: 3, inPosition: true, callers: 1, stack: 100 }).amount).toBe(12)
  })

  it('4벳이 스택의 40%를 넘으면 올인', () => {
    expect(preflopAdvice({ kind: '4bet', threeBetSize: 9, inPosition: true, stack: 100 })).toMatchObject({
      amount: 19.8,
      allIn: false,
    })
    expect(preflopAdvice({ kind: '4bet', threeBetSize: 12, inPosition: false, stack: 60 })).toMatchObject({
      amount: 60,
      allIn: true,
    })
  })
})
