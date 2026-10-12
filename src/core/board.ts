/**
 * 보드 텍스처와 드로우 분석
 */

import { ACE, rankOf, suitOf, type Card, type Rank } from './cards'
import type { Combo } from './equity'

export type Wetness = 'dry' | 'medium' | 'wet'

export interface BoardTexture {
  /** 같은 랭크가 2장 이상 */
  paired: boolean
  /** 한 무늬의 최대 장수 */
  maxSuit: number
  /** 연속한 5개 랭크 구간에 들어 있는 보드 랭크의 최대 개수 (스트레이트 가능성) */
  connected: number
  highRank: Rank
  wetness: Wetness
  /** 화면 표시용 설명 */
  notes: string[]
}

export const WETNESS_LABELS: Record<Wetness, string> = {
  dry: '드라이',
  medium: '보통',
  wet: '웻(드로우 많음)',
}

/** 랭크 마스크에 로우 에이스를 더한 14비트 마스크 (비트 0 = 로우 A, 비트 i+1 = 랭크 i) */
const withLowAce = (mask: number) => (mask << 1) | ((mask >> ACE) & 1)

function rankMask(cards: readonly Card[]): number {
  let m = 0
  for (const c of cards) m |= 1 << rankOf(c)
  return m
}

function popcount(x: number): number {
  let n = 0
  while (x) {
    x &= x - 1
    n++
  }
  return n
}

/** 연속한 5칸 구간 안에 들어 있는 랭크 수의 최댓값 */
function maxInWindow(mask: number): number {
  const m = withLowAce(mask)
  let best = 0
  for (let low = 0; low <= 9; low++) best = Math.max(best, popcount((m >> low) & 0x1f))
  return best
}

function hasStraight(mask: number): boolean {
  return maxInWindow(mask) === 5
}

function suitCounts(cards: readonly Card[]): number[] {
  const counts = [0, 0, 0, 0]
  for (const c of cards) counts[suitOf(c)]++
  return counts
}

export function analyzeBoard(board: readonly Card[]): BoardTexture {
  if (board.length < 3) throw new Error('보드는 3장 이상이어야 합니다')

  const ranks = board.map(rankOf)
  const paired = new Set(ranks).size < ranks.length
  const maxSuit = Math.max(...suitCounts(board))
  const connected = maxInWindow(rankMask(board))
  const highRank = Math.max(...ranks)
  const streetsLeft = board.length < 5

  const notes: string[] = []
  let score = 0

  if (maxSuit >= 3) {
    score += 2
    notes.push(maxSuit >= board.length && board.length === 3 ? '모노톤: 플러시가 이미 가능' : '같은 무늬 3장 이상: 플러시 가능')
  } else if (maxSuit === 2 && streetsLeft) {
    score += 1
    notes.push('같은 무늬 2장: 플러시 드로우 가능')
  } else {
    notes.push('레인보우: 플러시 걱정 적음')
  }

  if (connected >= 4) {
    score += 3
    notes.push('연결된 랭크 4장 이상: 한 장으로 스트레이트 완성 가능')
  } else if (connected === 3) {
    score += 2
    notes.push('연결된 랭크 3장: 스트레이트 가능')
  } else if (connected === 2 && streetsLeft) {
    score += 1
    notes.push('랭크가 조금 연결됨: 스트레이트 드로우 일부 가능')
  } else {
    notes.push('랭크가 떨어져 있음: 스트레이트 가능성 낮음')
  }

  if (paired) {
    score -= 1
    notes.push('페어 보드: 강한 핸드 조합이 줄어듦')
  }

  const wetness: Wetness = score >= 3 ? 'wet' : score <= 1 ? 'dry' : 'medium'
  return { paired, maxSuit, connected, highRank, wetness, notes }
}

export interface DrawInfo {
  flushDraw: boolean
  /** 스트레이트를 완성시키는 랭크 수: 2 이상 = 양방향(또는 더블 거트샷), 1 = 거트샷 */
  straightOutsRanks: number
  /** 화면 표시용 */
  labels: string[]
}

/**
 * 히어로의 드로우. 내 홀카드가 쓰이는 드로우만 센다 (보드만으로 되는 드로우 제외).
 * 이미 완성된 플러시·스트레이트는 드로우로 보지 않는다. 리버에서는 항상 없음.
 */
export function analyzeDraws(hero: Combo, board: readonly Card[]): DrawInfo {
  const none: DrawInfo = { flushDraw: false, straightOutsRanks: 0, labels: [] }
  if (board.length >= 5) return none

  const all = [...hero, ...board]
  const counts = suitCounts(all)
  const boardCounts = suitCounts(board)
  const flushDraw = counts.some((n, s) => n === 4 && boardCounts[s] < 4 && hero.some((c) => suitOf(c) === s))

  const allMask = rankMask(all)
  const boardMask = rankMask(board)
  let straightOutsRanks = 0
  if (!hasStraight(allMask)) {
    for (let r = 0; r <= ACE; r++) {
      const bit = 1 << r
      if (allMask & bit) continue
      if (hasStraight(allMask | bit) && !hasStraight(boardMask | bit)) straightOutsRanks++
    }
  }

  const labels: string[] = []
  if (flushDraw) labels.push('플러시 드로우')
  if (straightOutsRanks >= 2) labels.push('양방향 스트레이트 드로우')
  else if (straightOutsRanks === 1) labels.push('거트샷 스트레이트 드로우')
  return { flushDraw, straightOutsRanks, labels }
}
