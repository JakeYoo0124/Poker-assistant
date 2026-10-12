/**
 * 에퀴티(승률) 계산
 *
 * 각 플레이어는 "가능한 홀카드 조합 목록"으로 표현한다.
 *   - 특정 핸드: 조합 1개
 *   - 레인지:   조합 여러 개
 *   - 랜덤:     남은 카드로 만들 수 있는 모든 조합
 *
 * 경우의 수가 충분히 적으면 모든 경우를 열거해 정확히 계산하고(calculateExact),
 * 많으면 몬테카를로 시뮬레이션으로 근사한다(MonteCarloEquity).
 * 플레이어 0은 "나(히어로)"로 취급해 완성 족보 분포를 따로 집계한다.
 */

import { DECK_SIZE, cardToString, type Card } from './cards'
import { categoryOf, evaluate } from './evaluator'

export type Combo = readonly [Card, Card]

export type PlayerRange = { kind: 'random' } | { kind: 'combos'; combos: readonly Combo[] }

export interface EquityRequest {
  players: PlayerRange[]
  /** 0, 3, 4, 5장 */
  board: Card[]
}

export interface PlayerEquity {
  /** 무승부를 나눠 가진 몫까지 포함한 기대 지분 (0~1) */
  equity: number
  /** 단독 승리 비율 (0~1) */
  win: number
  /** 무승부 비율 (0~1) */
  tie: number
}

export interface EquityResult {
  players: PlayerEquity[]
  /** 계산한 경우의 수 (정확 계산) 또는 시뮬레이션 횟수 */
  samples: number
  exact: boolean
  /** 히어로가 리버에서 완성한 족보의 분포 (HandCategory 순서, 0~1) */
  heroCategories: number[]
}

/** 정확 계산을 선택하는 최대 판정 횟수 */
export const EXACT_LIMIT = 4_000_000

export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
  return Math.round(r)
}

/** 사용된 카드를 피해 만들 수 있는 모든 홀카드 조합 (최대 1326개) */
export function allCombos(dead: readonly Card[] = []): Combo[] {
  const used = new Set(dead)
  const combos: Combo[] = []
  for (let a = 0; a < DECK_SIZE; a++) {
    if (used.has(a)) continue
    for (let b = a + 1; b < DECK_SIZE; b++) {
      if (!used.has(b)) combos.push([b, a])
    }
  }
  return combos
}

interface Prepared {
  board: Card[]
  /** null = 랜덤 */
  combos: (Combo[] | null)[]
}

/** 요청을 검사하고, 보드와 겹치는 조합을 걸러낸다. 문제가 있으면 오류를 던진다. */
function prepare(req: EquityRequest): Prepared {
  const { players, board } = req
  if (players.length < 2) throw new Error('플레이어가 2명 이상 필요합니다')
  if (players.length > 10) throw new Error('플레이어는 최대 10명입니다')
  if (![0, 3, 4, 5].includes(board.length)) throw new Error('보드는 0, 3, 4, 5장이어야 합니다')

  const known = new Set<Card>()
  const addKnown = (c: Card) => {
    if (known.has(c)) throw new Error(`카드가 중복되었습니다: ${cardToString(c)}`)
    known.add(c)
  }
  board.forEach(addKnown)
  for (const p of players) {
    if (p.kind === 'combos' && p.combos.length === 1) p.combos[0].forEach(addKnown)
  }

  const boardSet = new Set(board)
  const combos = players.map((p, i) => {
    if (p.kind === 'random') return null
    const list = p.combos.filter(([a, b]) => !boardSet.has(a) && !boardSet.has(b))
    if (list.length === 0) throw new Error(`플레이어 ${i + 1}의 가능한 핸드가 없습니다`)
    return list
  })

  return { board: [...board], combos }
}

/** 정확 계산에 필요한 판정 횟수 추정치 (상한) */
export function exactWork(req: EquityRequest): number {
  const n = req.players.length
  const missing = 5 - req.board.length
  const unknownDeck = DECK_SIZE - req.board.length
  let assignments = 1
  for (const p of req.players) {
    assignments *= p.kind === 'random' ? choose(unknownDeck - 2, 2) : p.combos.length
  }
  return assignments * choose(unknownDeck - 2 * n, missing) * n
}

class Tally {
  readonly equity: Float64Array
  readonly win: Float64Array
  readonly tie: Float64Array
  readonly categories = new Float64Array(9)
  total = 0
  private readonly n: number

  constructor(n: number) {
    this.n = n
    this.equity = new Float64Array(n)
    this.win = new Float64Array(n)
    this.tie = new Float64Array(n)
  }

  record(scores: Int32Array) {
    const n = this.n
    let best = -1
    let count = 0
    for (let i = 0; i < n; i++) {
      const s = scores[i]
      if (s > best) {
        best = s
        count = 1
      } else if (s === best) {
        count++
      }
    }
    const share = 1 / count
    for (let i = 0; i < n; i++) {
      if (scores[i] === best) {
        this.equity[i] += share
        if (count === 1) this.win[i]++
        else this.tie[i]++
      }
    }
    this.categories[categoryOf(scores[0])]++
    this.total++
  }

  result(exact: boolean): EquityResult {
    const t = this.total || 1
    const players: PlayerEquity[] = []
    for (let i = 0; i < this.n; i++) {
      players.push({ equity: this.equity[i] / t, win: this.win[i] / t, tie: this.tie[i] / t })
    }
    return {
      players,
      samples: this.total,
      exact,
      heroCategories: Array.from(this.categories, (c) => c / t),
    }
  }
}

/** 7장 버퍼: [홀카드 2장, 보드 5장] */
function makeHandBuffers(n: number, board: readonly Card[]): Card[][] {
  return Array.from({ length: n }, () => {
    const h = new Array<Card>(7).fill(0)
    for (let j = 0; j < board.length; j++) h[2 + j] = board[j]
    return h
  })
}

/** 모든 경우를 열거해 정확한 에퀴티를 계산한다. */
export function calculateExact(req: EquityRequest): EquityResult {
  const { board, combos } = prepare(req)
  const n = combos.length
  const lists = combos.map((c) => c ?? allCombos(board))
  const missing = 5 - board.length

  const used = new Uint8Array(DECK_SIZE)
  for (const c of board) used[c] = 1

  const hands = makeHandBuffers(n, board)
  const scores = new Int32Array(n)
  const tally = new Tally(n)
  const runout = new Array<Card>(missing)

  const scoreAll = () => {
    for (let p = 0; p < n; p++) {
      const h = hands[p]
      for (let j = 0; j < missing; j++) h[2 + board.length + j] = runout[j]
      scores[p] = evaluate(h)
    }
    tally.record(scores)
  }

  const enumerateBoards = (start: number, depth: number) => {
    if (depth === missing) {
      scoreAll()
      return
    }
    for (let c = start; c < DECK_SIZE; c++) {
      if (used[c]) continue
      runout[depth] = c
      enumerateBoards(c + 1, depth + 1)
    }
  }

  const assign = (p: number) => {
    if (p === n) {
      enumerateBoards(0, 0)
      return
    }
    for (const [a, b] of lists[p]) {
      if (used[a] || used[b]) continue
      used[a] = used[b] = 1
      hands[p][0] = a
      hands[p][1] = b
      assign(p + 1)
      used[a] = used[b] = 0
    }
  }

  assign(0)
  if (tally.total === 0) throw new Error('카드가 겹치지 않는 경우가 없습니다')
  return tally.result(true)
}

/** 몬테카를로 시뮬레이션. run()을 여러 번 나눠 호출하며 중간 결과를 볼 수 있다. */
export class MonteCarloEquity {
  private readonly board: Card[]
  private readonly combos: (Combo[] | null)[]
  private readonly ranged: number[]
  private readonly randoms: number[]
  private readonly used = new Uint8Array(DECK_SIZE)
  private readonly hands: Card[][]
  private readonly scores: Int32Array
  private readonly tally: Tally
  private readonly random: () => number

  constructor(req: EquityRequest, random: () => number = Math.random) {
    this.random = random
    const { board, combos } = prepare(req)
    this.board = board
    this.combos = combos
    // 레인지 플레이어를 먼저 뽑고(겹치면 그 판 전체를 다시), 랜덤 플레이어는 남은 카드에서 뽑는다.
    this.ranged = combos.flatMap((c, i) => (c ? [i] : []))
    this.randoms = combos.flatMap((c, i) => (c ? [] : [i]))
    this.hands = makeHandBuffers(combos.length, board)
    this.scores = new Int32Array(combos.length)
    this.tally = new Tally(combos.length)
  }

  get samples(): number {
    return this.tally.total
  }

  private draw(): Card {
    const used = this.used
    let c: Card
    do {
      c = Math.floor(this.random() * DECK_SIZE)
    } while (used[c])
    used[c] = 1
    return c
  }

  run(iterations: number): void {
    const { used, hands, scores, board, combos } = this
    const n = combos.length
    let done = 0
    let rejected = 0

    while (done < iterations) {
      used.fill(0)
      for (const c of board) used[c] = 1

      let ok = true
      for (const p of this.ranged) {
        const list = combos[p]!
        const [a, b] = list[Math.floor(this.random() * list.length)]
        if (used[a] || used[b]) {
          ok = false
          break
        }
        used[a] = used[b] = 1
        hands[p][0] = a
        hands[p][1] = b
      }
      if (!ok) {
        if (++rejected > 100_000 && this.tally.total === 0) {
          throw new Error('카드가 겹치지 않는 경우를 찾지 못했습니다')
        }
        continue
      }

      for (const p of this.randoms) {
        hands[p][0] = this.draw()
        hands[p][1] = this.draw()
      }

      for (let j = board.length; j < 5; j++) {
        const c = this.draw()
        for (let p = 0; p < n; p++) hands[p][2 + j] = c
      }

      for (let p = 0; p < n; p++) scores[p] = evaluate(hands[p])
      this.tally.record(scores)
      done++
    }
  }

  result(): EquityResult {
    return this.tally.result(false)
  }
}

export interface OutsResult {
  /** 현재 보드 기준 히어로의 상태 */
  status: 'ahead' | 'tied' | 'behind'
  /** 다음 카드가 나오면 히어로가 단독으로 이기는 카드 */
  winning: Card[]
  /** 다음 카드가 나오면 비기는 카드 */
  tying: Card[]
  /** 다음 카드가 나오면 지는 카드 */
  losing: Card[]
  /** 다음에 나올 수 있는 카드 수 */
  remaining: number
}

/**
 * 상대 핸드를 모두 알 때, 다음 한 장(턴 또는 리버)에 따른 결과를 분류한다.
 * 플랍(3장) 또는 턴(4장)에서만 의미가 있다.
 */
export function calculateOuts(hero: Combo, opponents: readonly Combo[], board: readonly Card[]): OutsResult {
  if (board.length !== 3 && board.length !== 4) throw new Error('아웃츠는 플랍 또는 턴에서만 계산합니다')

  const known = [...hero, ...opponents.flat(), ...board]
  const used = new Set(known)
  if (used.size !== known.length) throw new Error('카드가 중복되었습니다')

  const compare = (cards: readonly Card[]) => {
    const heroScore = evaluate([...hero, ...cards])
    let best = -1
    for (const o of opponents) best = Math.max(best, evaluate([...o, ...cards]))
    return heroScore - best
  }

  const now = compare(board)
  const status = now > 0 ? 'ahead' : now === 0 ? 'tied' : 'behind'

  const winning: Card[] = []
  const tying: Card[] = []
  const losing: Card[] = []
  for (let c = DECK_SIZE - 1; c >= 0; c--) {
    if (used.has(c)) continue
    const diff = compare([...board, c])
    if (diff > 0) winning.push(c)
    else if (diff === 0) tying.push(c)
    else losing.push(c)
  }

  return { status, winning, tying, losing, remaining: DECK_SIZE - used.size }
}
