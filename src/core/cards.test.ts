// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  DECK_SIZE,
  cardToString,
  cardsToString,
  fullDeck,
  makeCard,
  parseCard,
  parseCards,
  rankOf,
  remainingDeck,
  shuffle,
  suitOf,
} from './cards'

describe('카드 표현', () => {
  it('랭크와 무늬를 숫자 하나에 담고 다시 꺼낼 수 있다', () => {
    for (let r = 0; r < 13; r++) {
      for (let s = 0; s < 4; s++) {
        const c = makeCard(r, s)
        expect(rankOf(c)).toBe(r)
        expect(suitOf(c)).toBe(s)
      }
    }
  })

  it('52장 모두 문자열로 바꿨다가 다시 읽으면 같은 카드다', () => {
    for (const c of fullDeck()) {
      expect(parseCard(cardToString(c))).toBe(c)
    }
  })

  it('다양한 표기를 읽는다', () => {
    expect(cardToString(parseCard('as'))).toBe('As')
    expect(cardToString(parseCard('10h'))).toBe('Th')
    expect(cardToString(parseCard('K♦'))).toBe('Kd')
    expect(cardToString(parseCard(' 2c '))).toBe('2c')
  })

  it('잘못된 표기는 오류를 낸다', () => {
    for (const bad of ['', 'A', 'Ax', '1s', '11h', 'AsK']) {
      expect(() => parseCard(bad)).toThrow()
    }
  })

  it('여러 장을 공백·쉼표 유무와 상관없이 읽는다', () => {
    expect(cardsToString(parseCards('AsKd'))).toBe('As Kd')
    expect(cardsToString(parseCards('As Kd, 10c'))).toBe('As Kd Tc')
    expect(parseCards('')).toEqual([])
  })

  it('중복 카드나 남는 글자가 있으면 오류를 낸다', () => {
    expect(() => parseCards('As As')).toThrow('중복')
    expect(() => parseCards('AsKdx')).toThrow()
  })
})

describe('덱', () => {
  it('풀 덱은 서로 다른 52장이다', () => {
    const deck = fullDeck()
    expect(deck).toHaveLength(DECK_SIZE)
    expect(new Set(deck).size).toBe(DECK_SIZE)
  })

  it('사용된 카드를 뺀 남은 덱을 만든다', () => {
    const dead = parseCards('As Kd 7h')
    const rest = remainingDeck(dead)
    expect(rest).toHaveLength(49)
    for (const c of dead) expect(rest).not.toContain(c)
  })

  it('셔플해도 카드 구성은 그대로다', () => {
    let seed = 42
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      return seed / 2 ** 31
    }
    const deck = shuffle(fullDeck(), random)
    expect(deck).not.toEqual(fullDeck())
    expect([...deck].sort((a, b) => a - b)).toEqual(fullDeck())
  })
})
