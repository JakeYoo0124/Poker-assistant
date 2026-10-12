/**
 * 프리플랍 핸드 클래스와 레인지
 *
 * 169개 핸드 클래스: 페어 13개("AA"), 수딧 78개("AKs"), 오프수딧 78개("AKo").
 * 13×13 그리드에서 row/col 0 = A, 12 = 2 이며
 *   대각선 = 페어, 대각선 위(오른쪽 위) = 수딧, 대각선 아래 = 오프수딧
 * 으로 배치한다 (일반적인 레인지 차트와 같은 배치).
 */

import { RANK_CHARS, makeCard, rankOf, suitOf, type Rank } from './cards'
import type { Combo } from './equity'

export type HandClass = string

export const GRID_SIZE = 13

interface ParsedClass {
  high: Rank
  low: Rank
  kind: 'pair' | 'suited' | 'offsuit'
}

const gridRank = (index: number): Rank => 12 - index

export function classAt(row: number, col: number): HandClass {
  const a = gridRank(row)
  const b = gridRank(col)
  if (row === col) return RANK_CHARS[a] + RANK_CHARS[a]
  if (row < col) return RANK_CHARS[a] + RANK_CHARS[b] + 's'
  return RANK_CHARS[b] + RANK_CHARS[a] + 'o'
}

/** 169개 클래스 (그리드 순서: 왼쪽 위 → 오른쪽 아래) */
export const ALL_CLASSES: readonly HandClass[] = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) =>
  classAt(Math.floor(i / GRID_SIZE), i % GRID_SIZE),
)

const CLASS_SET = new Set(ALL_CLASSES)

export function isHandClass(text: string): boolean {
  return CLASS_SET.has(text)
}

function parseClass(cls: HandClass): ParsedClass {
  if (!CLASS_SET.has(cls)) throw new Error(`잘못된 핸드: "${cls}"`)
  const high = RANK_CHARS.indexOf(cls[0])
  const low = RANK_CHARS.indexOf(cls[1])
  const kind = cls.length === 2 ? 'pair' : cls[2] === 's' ? 'suited' : 'offsuit'
  return { high, low, kind }
}

function makeClass(high: Rank, low: Rank, kind: ParsedClass['kind']): HandClass {
  if (kind === 'pair') return RANK_CHARS[high] + RANK_CHARS[high]
  return RANK_CHARS[high] + RANK_CHARS[low] + (kind === 'suited' ? 's' : 'o')
}

/** 해당 클래스의 실제 콤보 수: 페어 6, 수딧 4, 오프수딧 12 */
export function comboCountOf(cls: HandClass): number {
  const { kind } = parseClass(cls)
  return kind === 'pair' ? 6 : kind === 'suited' ? 4 : 12
}

export const TOTAL_COMBOS = 1326

/** 클래스에 속한 실제 홀카드 조합 */
export function classCombos(cls: HandClass): Combo[] {
  const { high, low, kind } = parseClass(cls)
  const combos: Combo[] = []
  for (let s1 = 0; s1 < 4; s1++) {
    for (let s2 = 0; s2 < 4; s2++) {
      if (kind === 'pair' && s2 <= s1) continue
      if (kind === 'suited' && s1 !== s2) continue
      if (kind === 'offsuit' && s1 === s2) continue
      combos.push([makeCard(high, s1), makeCard(kind === 'pair' ? high : low, s2)])
    }
  }
  return combos
}

/** 홀카드 2장이 속한 클래스 */
export function classOfCombo([a, b]: Combo): HandClass {
  const ra = rankOf(a)
  const rb = rankOf(b)
  if (ra === rb) return makeClass(ra, ra, 'pair')
  const [high, low] = ra > rb ? [ra, rb] : [rb, ra]
  return makeClass(high, low, suitOf(a) === suitOf(b) ? 'suited' : 'offsuit')
}

export function rangeCombos(classes: Iterable<HandClass>): Combo[] {
  const combos: Combo[] = []
  for (const cls of classes) combos.push(...classCombos(cls))
  return combos
}

export function countCombos(classes: Iterable<HandClass>): number {
  let n = 0
  for (const cls of classes) n += comboCountOf(cls)
  return n
}

// ───────────────────────── 텍스트 표기 ─────────────────────────

const rankIndex = (ch: string): Rank => {
  const r = RANK_CHARS.indexOf(ch.toUpperCase())
  if (r < 0) throw new Error(`잘못된 랭크: "${ch}"`)
  return r
}

/** "QQ", "AKs", "AKo", "AK"(수딧+오프수딧) 하나를 읽는다 */
function parseToken(token: string): { high: Rank; low: Rank; kinds: ParsedClass['kind'][] } {
  const m = /^([2-9TJQKA])([2-9TJQKA])([so])?$/i.exec(token)
  if (!m) throw new Error(`잘못된 핸드 표기: "${token}"`)
  let high = rankIndex(m[1])
  let low = rankIndex(m[2])
  if (low > high) [high, low] = [low, high]
  if (high === low) {
    if (m[3]) throw new Error(`페어에는 s/o를 붙일 수 없습니다: "${token}"`)
    return { high, low, kinds: ['pair'] }
  }
  const suffix = m[3]?.toLowerCase()
  const kinds: ParsedClass['kind'][] = suffix === 's' ? ['suited'] : suffix === 'o' ? ['offsuit'] : ['suited', 'offsuit']
  return { high, low, kinds }
}

/**
 * 표준 레인지 표기를 읽는다.
 *   "QQ+"        QQ, KK, AA
 *   "22-55"      22, 33, 44, 55
 *   "ATs+"       ATs, AJs, AQs, AKs
 *   "A2s-A5s"    A2s ~ A5s
 *   "AK"         AKs + AKo
 * 쉼표나 공백으로 구분한다.
 */
export function parseRange(text: string): Set<HandClass> {
  const result = new Set<HandClass>()
  const tokens = text.split(/[\s,]+/).filter(Boolean)

  for (const raw of tokens) {
    const token = raw.trim()
    if (token.endsWith('+')) {
      const { high, low, kinds } = parseToken(token.slice(0, -1))
      for (const kind of kinds) {
        if (kind === 'pair') {
          for (let r = high; r <= 12; r++) result.add(makeClass(r, r, 'pair'))
        } else {
          for (let r = low; r < high; r++) result.add(makeClass(high, r, kind))
        }
      }
      continue
    }

    const dash = token.split('-')
    if (dash.length === 2) {
      const a = parseToken(dash[0])
      const b = parseToken(dash[1])
      if (a.kinds.join() !== b.kinds.join()) throw new Error(`범위 양쪽의 종류가 다릅니다: "${token}"`)
      if (a.kinds[0] === 'pair') {
        const [from, to] = a.high < b.high ? [a.high, b.high] : [b.high, a.high]
        for (let r = from; r <= to; r++) result.add(makeClass(r, r, 'pair'))
      } else {
        if (a.high !== b.high) throw new Error(`범위의 높은 카드가 같아야 합니다: "${token}"`)
        const [from, to] = a.low < b.low ? [a.low, b.low] : [b.low, a.low]
        for (const kind of a.kinds) {
          for (let r = from; r <= to; r++) result.add(makeClass(a.high, r, kind))
        }
      }
      continue
    }
    if (dash.length > 2) throw new Error(`잘못된 범위 표기: "${token}"`)

    const { high, low, kinds } = parseToken(token)
    for (const kind of kinds) result.add(makeClass(high, low, kind))
  }
  return result
}

/** 연속 구간 [from, to] 목록 */
function runs(values: number[]): [number, number][] {
  const sorted = [...values].sort((a, b) => b - a)
  const out: [number, number][] = []
  for (const v of sorted) {
    const last = out[out.length - 1]
    if (last && last[0] === v + 1) last[0] = v
    else out.push([v, v])
  }
  return out // 각 구간은 [낮은 값, 높은 값]
}

/** 클래스 집합을 짧은 표준 표기로 바꾼다 (parseRange의 역) */
export function formatRange(classes: Iterable<HandClass>): string {
  const pairs: number[] = []
  const byHigh = { suited: new Map<Rank, Rank[]>(), offsuit: new Map<Rank, Rank[]>() }

  for (const cls of classes) {
    const { high, low, kind } = parseClass(cls)
    if (kind === 'pair') pairs.push(high)
    else {
      const map = byHigh[kind]
      if (!map.has(high)) map.set(high, [])
      map.get(high)!.push(low)
    }
  }

  const parts: string[] = []
  for (const [lo, hi] of runs(pairs)) {
    const c = (r: Rank) => makeClass(r, r, 'pair')
    if (hi === 12 && lo !== hi) parts.push(`${c(lo)}+`)
    else if (lo === hi) parts.push(c(lo))
    else parts.push(`${c(hi)}-${c(lo)}`)
  }

  for (const kind of ['suited', 'offsuit'] as const) {
    const highs = [...byHigh[kind].keys()].sort((a, b) => b - a)
    for (const high of highs) {
      for (const [lo, hi] of runs(byHigh[kind].get(high)!)) {
        const c = (r: Rank) => makeClass(high, r, kind)
        if (hi === high - 1 && lo !== hi) parts.push(`${c(lo)}+`)
        else if (lo === hi) parts.push(c(lo))
        else parts.push(`${c(hi)}-${c(lo)}`)
      }
    }
  }
  return parts.join(', ')
}
