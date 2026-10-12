// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cardsToString, parseCards } from './cards'
import {
  ALL_CLASSES,
  TOTAL_COMBOS,
  classAt,
  classCombos,
  classOfCombo,
  comboCountOf,
  countCombos,
  formatRange,
  parseRange,
  rangeCombos,
} from './range'

const sorted = (set: Set<string>) => [...set].sort()

describe('핸드 클래스', () => {
  it('169개이고 모두 다르다', () => {
    expect(ALL_CLASSES).toHaveLength(169)
    expect(new Set(ALL_CLASSES).size).toBe(169)
  })

  it('그리드 배치: 대각선 페어, 위쪽 수딧, 아래쪽 오프수딧', () => {
    expect(classAt(0, 0)).toBe('AA')
    expect(classAt(0, 1)).toBe('AKs')
    expect(classAt(1, 0)).toBe('AKo')
    expect(classAt(12, 12)).toBe('22')
    expect(classAt(11, 12)).toBe('32s')
    expect(classAt(12, 0)).toBe('A2o')
  })

  it('콤보 수 합계는 1326이다', () => {
    expect(countCombos(ALL_CLASSES)).toBe(TOTAL_COMBOS)
    expect(comboCountOf('AA')).toBe(6)
    expect(comboCountOf('AKs')).toBe(4)
    expect(comboCountOf('AKo')).toBe(12)
  })

  it('실제 콤보를 만들고, 각 콤보는 다시 같은 클래스로 돌아온다', () => {
    const all = rangeCombos(ALL_CLASSES)
    expect(all).toHaveLength(TOTAL_COMBOS)
    expect(new Set(all.map(([a, b]) => Math.min(a, b) * 52 + Math.max(a, b))).size).toBe(TOTAL_COMBOS)
    for (const cls of ALL_CLASSES) {
      for (const combo of classCombos(cls)) expect(classOfCombo(combo)).toBe(cls)
    }
  })

  it('홀카드로 클래스를 찾는다', () => {
    const [a, b] = parseCards('7h Ah')
    expect(classOfCombo([a, b])).toBe('A7s')
    const [c, d] = parseCards('Kd 9c')
    expect(classOfCombo([c, d])).toBe('K9o')
    expect(cardsToString(classCombos('AKs')[0])).toMatch(/^A. K.$/)
  })
})

describe('레인지 표기 읽기', () => {
  it('페어 범위', () => {
    expect(sorted(parseRange('QQ+'))).toEqual(['AA', 'KK', 'QQ'])
    expect(sorted(parseRange('22-44'))).toEqual(['22', '33', '44'])
    expect(sorted(parseRange('44-22'))).toEqual(['22', '33', '44'])
  })

  it('키커 범위', () => {
    expect(sorted(parseRange('ATs+'))).toEqual(['AJs', 'AKs', 'AQs', 'ATs'])
    expect(sorted(parseRange('A2s-A4s'))).toEqual(['A2s', 'A3s', 'A4s'])
    expect(sorted(parseRange('KQo'))).toEqual(['KQo'])
  })

  it('s/o를 생략하면 둘 다', () => {
    expect(sorted(parseRange('AK'))).toEqual(['AKo', 'AKs'])
    expect(sorted(parseRange('KA'))).toEqual(['AKo', 'AKs'])
  })

  it('여러 개를 쉼표·공백으로 구분하고 대소문자를 가리지 않는다', () => {
    const r = parseRange('qq+, aks  AQo,76s')
    expect(sorted(r)).toEqual(['76s', 'AA', 'AKs', 'AQo', 'KK', 'QQ'])
  })

  it('빈 문자열은 빈 레인지', () => {
    expect(parseRange('  ').size).toBe(0)
  })

  it('잘못된 표기는 오류', () => {
    for (const bad of ['AX', 'AAs', 'A2s-K5s', 'A2s-A5o', 'QQ-AKs', 'A', 'A2s-A3s-A4s']) {
      expect(() => parseRange(bad), bad).toThrow()
    }
  })
})

describe('레인지 표기 쓰기', () => {
  it.each([
    ['QQ+', 'QQ+'],
    ['22-55', '55-22'],
    ['AA', 'AA'],
    ['ATs+', 'ATs+'],
    ['A2s-A5s', 'A5s-A2s'],
    ['AKo, AQo', 'AQo+'],
    ['KQs, KJs, K9s', 'KJs+, K9s'],
    ['QQ+, 88-66, AJs+, A5s-A4s, KQo', 'QQ+, 88-66, AJs+, A5s-A4s, KQo'],
  ])('%s → %s', (input, expected) => {
    expect(formatRange(parseRange(input))).toBe(expected)
  })

  it('전체 레인지도 되돌리면 같은 집합이다', () => {
    const all = new Set(ALL_CLASSES)
    expect(sorted(parseRange(formatRange(all)))).toEqual(sorted(all))
  })
})
