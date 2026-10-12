/**
 * 카드 표현
 *
 * 카드 한 장은 0~51 정수로 표현한다.
 *   rank = card >> 2   (0 = 2, 1 = 3, ..., 8 = T, 9 = J, 10 = Q, 11 = K, 12 = A)
 *   suit = card & 3    (0 = ♣ c, 1 = ♦ d, 2 = ♥ h, 3 = ♠ s)
 *
 * 문자열 표기는 "As", "Td", "7h"처럼 랭크 문자 + 무늬 문자를 쓴다.
 */

export type Card = number
export type Rank = number
export type Suit = number

export const RANK_CHARS = '23456789TJQKA'
export const SUIT_CHARS = 'cdhs'
export const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'] as const

export const RANK_COUNT = 13
export const SUIT_COUNT = 4
export const DECK_SIZE = 52

export const ACE: Rank = 12

export function makeCard(rank: Rank, suit: Suit): Card {
  return (rank << 2) | suit
}

export function rankOf(card: Card): Rank {
  return card >> 2
}

export function suitOf(card: Card): Suit {
  return card & 3
}

export function isValidCard(card: Card): boolean {
  return Number.isInteger(card) && card >= 0 && card < DECK_SIZE
}

/** "As" → 카드 번호. 랭크는 "10"도 허용하고 대소문자를 구분하지 않는다. */
export function parseCard(text: string): Card {
  const t = text.trim()
  const m = /^(10|[2-9tjqka])([cdhs♣♦♥♠])$/i.exec(t)
  if (!m) throw new Error(`잘못된 카드 표기: "${text}"`)

  const rankText = m[1].toUpperCase() === '10' ? 'T' : m[1].toUpperCase()
  const rank = RANK_CHARS.indexOf(rankText)

  const suitText = m[2].toLowerCase()
  const symbolIndex = SUIT_SYMBOLS.indexOf(suitText as (typeof SUIT_SYMBOLS)[number])
  const suit = symbolIndex >= 0 ? symbolIndex : SUIT_CHARS.indexOf(suitText)

  return makeCard(rank, suit)
}

/** "AsKd", "As Kd", "As,Kd" 모두 허용. 중복 카드가 있으면 오류. */
export function parseCards(text: string): Card[] {
  const compact = text.replace(/[\s,]+/g, '')
  if (compact === '') return []

  const tokens = compact.match(/(10|[2-9tjqka])[cdhs♣♦♥♠]/gi)
  if (!tokens || tokens.join('').length !== compact.length) {
    throw new Error(`잘못된 카드 표기: "${text}"`)
  }

  const cards = tokens.map(parseCard)
  assertNoDuplicates(cards)
  return cards
}

export function cardToString(card: Card): string {
  return RANK_CHARS[rankOf(card)] + SUIT_CHARS[suitOf(card)]
}

export function cardsToString(cards: readonly Card[]): string {
  return cards.map(cardToString).join(' ')
}

export function rankToChar(rank: Rank): string {
  return RANK_CHARS[rank]
}

export function assertNoDuplicates(cards: readonly Card[]): void {
  const seen = new Set<Card>()
  for (const c of cards) {
    if (seen.has(c)) throw new Error(`중복된 카드: ${cardToString(c)}`)
    seen.add(c)
  }
}

export function fullDeck(): Card[] {
  return Array.from({ length: DECK_SIZE }, (_, i) => i)
}

/** 이미 사용된 카드(dead cards)를 뺀 남은 덱 */
export function remainingDeck(dead: readonly Card[]): Card[] {
  const used = new Set(dead)
  return fullDeck().filter((c) => !used.has(c))
}

/** Fisher–Yates 셔플 (제자리). 테스트를 위해 난수 함수를 주입할 수 있다. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }
  return items
}
