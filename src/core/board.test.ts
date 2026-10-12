// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseCards } from './cards'
import { analyzeBoard, analyzeDraws } from './board'
import type { Combo } from './equity'

const combo = (t: string): Combo => {
  const [a, b] = parseCards(t)
  return [a, b]
}

describe('보드 텍스처', () => {
  it('K72 레인보우는 드라이', () => {
    const t = analyzeBoard(parseCards('Kc 7d 2h'))
    expect(t.wetness).toBe('dry')
    expect(t.paired).toBe(false)
    expect(t.maxSuit).toBe(1)
  })

  it('9h 8h 7c는 웻', () => {
    const t = analyzeBoard(parseCards('9h 8h 7c'))
    expect(t.wetness).toBe('wet')
    expect(t.connected).toBe(3)
  })

  it('모노톤 보드는 웻', () => {
    expect(analyzeBoard(parseCards('Ks 8s 3s')).wetness).not.toBe('dry')
  })

  it('A-2-3은 휠 쪽으로 연결된 것으로 본다', () => {
    expect(analyzeBoard(parseCards('Ac 2d 3h')).connected).toBe(3)
  })

  it('페어 보드를 감지한다', () => {
    expect(analyzeBoard(parseCards('Qc Qd 4h')).paired).toBe(true)
  })

  it('3장 미만이면 오류', () => {
    expect(() => analyzeBoard(parseCards('Ac 2d'))).toThrow()
  })
})

describe('드로우', () => {
  it('플러시 드로우', () => {
    const d = analyzeDraws(combo('Ah 5h'), parseCards('Kh 8h 2c'))
    expect(d.flushDraw).toBe(true)
    expect(d.labels).toContain('플러시 드로우')
  })

  it('보드에 같은 무늬 4장이면 내 플러시 드로우가 아니다 (이미 완성 또는 보드 드로우)', () => {
    expect(analyzeDraws(combo('Ac 5d'), parseCards('Kh 8h 2h 4h')).flushDraw).toBe(false)
  })

  it('양방향 스트레이트 드로우', () => {
    const d = analyzeDraws(combo('9c 8d'), parseCards('7h 6s 2c'))
    expect(d.straightOutsRanks).toBe(2)
  })

  it('거트샷', () => {
    const d = analyzeDraws(combo('9c 8d'), parseCards('6h 5s Kc'))
    expect(d.straightOutsRanks).toBe(1)
  })

  it('보드만으로 되는 스트레이트 드로우는 세지 않는다', () => {
    // 보드 9-8-7-6: 아무 T, 5가 들어와도 보드 스트레이트. 내 손(A2)은 기여하지 않음
    expect(analyzeDraws(combo('Ac 2d'), parseCards('9h 8s 7c 6d')).straightOutsRanks).toBe(0)
  })

  it('이미 스트레이트가 완성되면 드로우가 아니다', () => {
    expect(analyzeDraws(combo('9c 8d'), parseCards('7h 6s 5c')).straightOutsRanks).toBe(0)
  })

  it('리버에서는 드로우가 없다', () => {
    expect(analyzeDraws(combo('Ah 5h'), parseCards('Kh 8h 2c 3d 9s')).labels).toEqual([])
  })
})
