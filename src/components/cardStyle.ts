import { RANK_CHARS, rankOf, suitOf, type Card } from '../core/cards'

/** 4색 덱: ♣ 초록, ♦ 파랑, ♥ 빨강, ♠ 검정 — 무늬를 헷갈리지 않게 한다 */
export const SUIT_TEXT_CLASSES = [
  'text-green-600 dark:text-green-400',
  'text-blue-600 dark:text-blue-400',
  'text-red-600 dark:text-red-400',
  'text-slate-900 dark:text-slate-100',
] as const

export const SUIT_NAMES = ['클로버', '다이아몬드', '하트', '스페이드'] as const

/** 화면에 보이는 랭크 글자 (T는 10으로 표시) */
export function rankLabel(card: Card): string {
  const rank = RANK_CHARS[rankOf(card)]
  return rank === 'T' ? '10' : rank
}

export function cardAriaLabel(card: Card): string {
  return `${SUIT_NAMES[suitOf(card)]} ${rankLabel(card)}`
}
