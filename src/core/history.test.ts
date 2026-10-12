// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseCards } from './cards'
import { applyAction, newHand, type Action } from './game'
import {
  blindsFor,
  playActions,
  potTotal,
  practiceToStored,
  replaySteps,
  suggestedNet,
  toCall,
  type HistoryAction,
  type StoredHand,
} from './history'
import { seededRandom } from './random'

const hand = (actions: HistoryAction[], patch: Partial<StoredHand> = {}): StoredHand => ({
  createdAt: '2026-10-12T00:00:00.000Z',
  source: 'manual',
  sessionId: null,
  heroPosition: 'BTN',
  villainPosition: 'BB',
  effectiveStack: 100,
  heroCards: parseCards('As Kd'),
  villainCards: null,
  board: parseCards('Ah 7c 2d 9s 3h'),
  actions,
  heroNet: 0,
  notes: '',
  ...patch,
})

const a = (street: HistoryAction['street'], actor: HistoryAction['actor'], type: HistoryAction['type'], amount = 0): HistoryAction => ({
  street,
  actor,
  type,
  amount,
})

describe('블라인드', () => {
  it('포지션에 따라 블라인드를 내고 나머지는 데드 머니', () => {
    expect(blindsFor('BTN', 'BB')).toEqual({ hero: 0, villain: 1, dead: 0.5 })
    expect(blindsFor('SB', 'BB')).toEqual({ hero: 0.5, villain: 1, dead: 0 })
    expect(blindsFor('CO', 'BTN')).toEqual({ hero: 0, villain: 0, dead: 1.5 })
  })
})

describe('액션 진행', () => {
  // BTN 2.5 오픈, BB 콜 → 플랍 BB 체크, BTN 3 베팅, BB 콜 → 턴 체크 체크 → 리버 BB 베팅 10, BTN 콜
  const actions = [
    a('preflop', 'hero', 'raise', 2.5),
    a('preflop', 'villain', 'call', 1.5),
    a('flop', 'villain', 'check'),
    a('flop', 'hero', 'bet', 3),
    a('flop', 'villain', 'call', 3),
    a('turn', 'villain', 'check'),
    a('turn', 'hero', 'check'),
    a('river', 'villain', 'bet', 10),
    a('river', 'hero', 'call', 10),
  ]

  it('팟과 투자금을 계산한다', () => {
    const st = playActions(hand(actions))
    expect(potTotal(st)).toBe(31.5) // 0.5 데드 + 2.5×2 + 3×2 + 10×2
    expect(st.invested).toEqual({ hero: 15.5, villain: 15.5 })
  })

  it('콜 금액을 계산한다', () => {
    const st = playActions(hand(actions), 1) // BTN 2.5 오픈까지
    expect(toCall(st, 'villain')).toBe(1.5)
    expect(toCall(st, 'hero')).toBe(0)
  })

  it('이김·짐·스플릿 손익', () => {
    const h = hand(actions)
    expect(suggestedNet(h, 'win')).toBe(16) // 31.5 − 15.5
    expect(suggestedNet(h, 'lose')).toBe(-15.5)
    expect(suggestedNet(h, 'split')).toBe(0.25)
  })

  it('콜받지 못한 베팅은 손익에 넣지 않는다', () => {
    const h = hand([a('preflop', 'hero', 'raise', 2.5), a('preflop', 'villain', 'fold')])
    expect(suggestedNet(h, 'win')).toBe(1.5) // 데드 SB 0.5 + BB 1
  })

  it('리플레이 단계: 블라인드 + 액션마다 한 단계, 보드는 스트리트에 맞게', () => {
    const steps = replaySteps(hand(actions))
    expect(steps).toHaveLength(actions.length + 1)
    expect(steps[0].pot).toBe(1.5)
    expect(steps[3].board).toHaveLength(3) // 플랍 첫 액션
    expect(steps[steps.length - 1].board).toHaveLength(5)
  })

  it('프리플랍 올인이면 마지막에 보드 전체를 보여주는 단계가 붙는다', () => {
    const steps = replaySteps(hand([a('preflop', 'hero', 'raise', 100), a('preflop', 'villain', 'call', 99)]))
    expect(steps[steps.length - 1].board).toHaveLength(5)
    expect(steps).toHaveLength(4)
  })
})

describe('연습 게임 핸드 변환', () => {
  it('게임 상태를 기록으로 바꾸고, 리플레이 팟이 실제 팟과 맞는다', () => {
    const random = seededRandom(4)
    let s = newHand([100, 100], 0, random)
    const plan: Action[] = [{ type: 'raise', to: 3 }, { type: 'call' }, { type: 'check' }, { type: 'raise', to: 4 }, { type: 'call' }]
    for (const act of plan) s = applyAction(s, s.toAct!, act)
    // 턴·리버 체크
    while (s.toAct !== null) s = applyAction(s, s.toAct, { type: 'check' })

    const stored = practiceToStored(s, 0, 'tag', [])
    expect(stored.heroPosition).toBe('SB')
    expect(stored.actions).toHaveLength(s.log.length)
    expect(stored.villainCards).not.toBeNull() // 쇼다운
    const st = playActions(stored)
    expect(potTotal(st)).toBe(14) // 3×2 + 4×2
    const outcome = s.result!.winners.length === 2 ? 'split' : s.result!.winners[0] === 0 ? 'win' : 'lose'
    expect(suggestedNet(stored, outcome)).toBe(stored.heroNet)
  })

  it('끝나지 않은 핸드는 변환할 수 없다', () => {
    expect(() => practiceToStored(newHand([100, 100], 0), 0, 'tag', [])).toThrow()
  })
})
