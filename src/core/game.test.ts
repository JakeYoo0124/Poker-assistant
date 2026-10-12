// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseCards } from './cards'
import {
  applyAction,
  legalActions,
  netResult,
  newHand,
  totalPot,
  type Action,
  type HandState,
  type PlayerId,
} from './game'
import { seededRandom } from './random'

const start = (stacks: [number, number] = [100, 100], button: PlayerId = 0, seed = 1) =>
  newHand(stacks, button, seededRandom(seed))

const play = (s: HandState, ...actions: Action[]) =>
  actions.reduce((st, a) => applyAction(st, st.toAct!, a), s)

const total = (s: HandState) => s.stacks[0] + s.stacks[1] + totalPot(s)

/** 손패와 보드를 정해 둔 상태로 바꾼다 (덱에서 해당 카드를 빼고 보드 순서대로 뽑히게 함) */
function rig(s: HandState, hole0: string, hole1: string, board: string): HandState {
  const h0 = parseCards(hole0)
  const h1 = parseCards(hole1)
  const b = parseCards(board)
  const used = new Set([...h0, ...h1, ...b])
  const rest = Array.from({ length: 52 }, (_, i) => i).filter((c) => !used.has(c))
  return { ...s, holes: [[h0[0], h0[1]], [h1[0], h1[1]]], deck: [...rest, ...[...b].reverse()] }
}

describe('핸드 시작', () => {
  it('버튼이 SB, 상대가 BB를 내고 버튼이 먼저 행동한다', () => {
    const s = start([100, 100], 0)
    expect(s.committed).toEqual([0.5, 1])
    expect(s.stacks).toEqual([99.5, 99])
    expect(s.toAct).toBe(0)
    expect(s.holes[0]).toHaveLength(2)
    expect(s.deck).toHaveLength(48)
  })

  it('SB 콜, BB 체크 → 플랍 3장, BB가 먼저 행동', () => {
    const s = play(start(), { type: 'call' }, { type: 'check' })
    expect(s.street).toBe('flop')
    expect(s.board).toHaveLength(3)
    expect(s.pot).toBe(2)
    expect(s.toAct).toBe(1)
  })

  it('SB가 콜해도 BB에게 옵션(체크·레이즈)이 있다', () => {
    const s = play(start(), { type: 'call' })
    expect(s.toAct).toBe(1)
    const legal = legalActions(s)
    expect(legal.canCheck).toBe(true)
    expect(legal.canRaise).toBe(true)
  })
})

describe('베팅 규칙', () => {
  it('최소 레이즈는 직전 레이즈 증가분 이상', () => {
    let s = start()
    expect(legalActions(s).minRaiseTo).toBe(2) // 1 + 1
    s = play(s, { type: 'raise', to: 3 }) // 증가분 2
    expect(legalActions(s).minRaiseTo).toBe(5) // 3 + 2
    expect(() => applyAction(s, 1, { type: 'raise', to: 4 })).toThrow()
  })

  it('차례가 아닌 플레이어는 행동할 수 없다', () => {
    expect(() => applyAction(start(), 1, { type: 'call' })).toThrow('차례')
  })

  it('체크 가능한 상황에서는 폴드할 수 없다', () => {
    const s = play(start(), { type: 'call' })
    expect(() => applyAction(s, 1, { type: 'fold' })).toThrow()
  })

  it('폴드하면 상대가 팟을 가져간다', () => {
    const s = play(start(), { type: 'raise', to: 2.5 }, { type: 'fold' })
    expect(s.result?.winners).toEqual([0])
    expect(s.toAct).toBeNull()
    expect(netResult(s)).toEqual([1, -1])
  })

  it('포스트플랍 베팅과 레이즈, 콜 후 다음 스트리트', () => {
    let s = play(start(), { type: 'raise', to: 2.5 }, { type: 'call' }) // 팟 5
    expect(s.street).toBe('flop')
    s = play(s, { type: 'raise', to: 3 }, { type: 'raise', to: 9 }, { type: 'call' })
    expect(s.street).toBe('turn')
    expect(s.pot).toBe(23)
    expect(s.log.map((r) => r.type)).toEqual(['raise', 'call', 'bet', 'raise', 'call'])
  })
})

describe('쇼다운과 올인', () => {
  it('리버까지 체크하면 쇼다운으로 더 좋은 패가 이긴다', () => {
    let s = rig(start(), 'As Ah', 'Kc Kd', '2c 7d 9h Js 3c')
    s = play(s, { type: 'call' }, { type: 'check' })
    for (let i = 0; i < 3; i++) s = play(s, { type: 'check' }, { type: 'check' })
    expect(s.result).toMatchObject({ winners: [0], showdown: true })
    expect(netResult(s)).toEqual([1, -1])
  })

  it('보드가 이기면 팟을 나눈다', () => {
    let s = rig(start(), '2c 3d', '4c 5d', 'As Ks Qs Js Ts')
    s = play(s, { type: 'raise', to: 3 }, { type: 'call' })
    for (let i = 0; i < 3; i++) s = play(s, { type: 'check' }, { type: 'check' })
    expect(s.result?.winners).toEqual([0, 1])
    expect(netResult(s)).toEqual([0, 0])
  })

  it('프리플랍 올인·콜이면 보드를 끝까지 깔고 쇼다운', () => {
    let s = rig(start(), 'As Ah', 'Kc Kd', '2c 7d 9h Js 3c')
    s = play(s, { type: 'raise', to: 100 }, { type: 'call' })
    expect(s.board).toHaveLength(5)
    expect(s.result?.showdown).toBe(true)
    expect(s.stacks).toEqual([200, 0])
  })

  it('스택이 다르면 콜받지 못한 차액을 돌려준다', () => {
    let s = rig(start([100, 40], 0), 'Kc Kd', 'As Ah', '2c 7d 9h Js 3c')
    s = play(s, { type: 'raise', to: 100 }, { type: 'call' })
    // 플레이어 1은 40만 걸 수 있으므로 팟은 80, 플레이어 0은 60을 돌려받는다
    expect(s.result?.winners).toEqual([1])
    expect(s.stacks).toEqual([60, 80])
  })

  it('올인 금액보다 많이 콜할 수 없다', () => {
    const s = play(start([100, 30], 0), { type: 'raise', to: 50 })
    expect(legalActions(s).callAmount).toBe(29)
    expect(legalActions(s).canRaise).toBe(false)
  })

  it('블라인드만으로 올인이면 바로 진행된다', () => {
    const s = start([0.3, 100], 0)
    // SB 0.3 올인 → BB는 체크만 하면 쇼다운
    expect(s.toAct).toBe(1)
    const end = play(s, { type: 'check' })
    expect(end.result).not.toBeNull()
    expect(end.stacks[0] + end.stacks[1]).toBeCloseTo(100.3)
  })
})

describe('무작위 플레이 검증', () => {
  it('어떤 행동을 해도 칩 총량이 보존되고 핸드는 끝난다', () => {
    const random = seededRandom(99)
    for (let game = 0; game < 3000; game++) {
      const stacks: [number, number] = [1 + Math.floor(random() * 150), 1 + Math.floor(random() * 150)]
      let s = newHand(stacks, (game % 2) as PlayerId, random)
      const startTotal = stacks[0] + stacks[1]
      let steps = 0
      while (s.toAct !== null) {
        const legal = legalActions(s)
        const r = random()
        let a: Action
        if (legal.canRaise && r < 0.3) {
          const to = legal.minRaiseTo + random() * (legal.maxRaiseTo - legal.minRaiseTo)
          a = { type: 'raise', to: r < 0.05 ? legal.maxRaiseTo : Math.max(legal.minRaiseTo, Math.round(to * 2) / 2) }
        } else if (legal.canFold && r < 0.45) a = { type: 'fold' }
        else if (legal.canCheck) a = { type: 'check' }
        else a = { type: 'call' }
        s = applyAction(s, s.toAct, a)
        expect(total(s)).toBeCloseTo(startTotal, 6)
        expect(s.stacks[0]).toBeGreaterThanOrEqual(0)
        expect(s.stacks[1]).toBeGreaterThanOrEqual(0)
        if (++steps > 200) throw new Error('핸드가 끝나지 않음')
      }
      expect(s.result).not.toBeNull()
      expect(s.stacks[0] + s.stacks[1]).toBeCloseTo(startTotal, 6)
      if (s.result!.showdown) expect(s.board).toHaveLength(5)
    }
  })
})
