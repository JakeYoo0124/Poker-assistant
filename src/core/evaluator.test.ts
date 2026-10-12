// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cardsToString, parseCards, type Card } from './cards'
import {
  HandCategory,
  bestFiveCards,
  categoryOf,
  describeScore,
  evaluate,
} from './evaluator'

const score = (text: string) => evaluate(parseCards(text))
const category = (text: string) => categoryOf(score(text))

describe('족보 판정', () => {
  it.each([
    ['As Ks Qs Js Ts', HandCategory.StraightFlush],
    ['5d 4d 3d 2d Ad', HandCategory.StraightFlush],
    ['9c 9d 9h 9s 2c', HandCategory.FourOfAKind],
    ['Kc Kd Kh 7s 7c', HandCategory.FullHouse],
    ['Ah 9h 7h 4h 2h', HandCategory.Flush],
    ['Tc 9d 8h 7s 6c', HandCategory.Straight],
    ['5c 4d 3h 2s Ac', HandCategory.Straight],
    ['Qc Qd Qh 7s 2c', HandCategory.ThreeOfAKind],
    ['Jc Jd 4h 4s Ac', HandCategory.TwoPair],
    ['Tc Td 8h 4s 2c', HandCategory.OnePair],
    ['Ac Jd 8h 4s 2c', HandCategory.HighCard],
  ])('%s → %i', (hand, expected) => {
    expect(category(hand)).toBe(expected)
  })

  it('Q-K-A-2-3은 스트레이트가 아니다', () => {
    expect(category('Qc Kd Ah 2s 3c')).toBe(HandCategory.HighCard)
  })

  it('상위 족보가 하위 족보를 이긴다', () => {
    const ordered = [
      'Ac Jd 8h 4s 2c',
      '2c 2d 3h 4s 7c',
      '2c 2d 3h 3s 4c',
      '2c 2d 2h 3s 4c',
      '5c 4d 3h 2s Ac',
      '2h 3h 4h 5h 7h',
      '2c 2d 2h 3s 3c',
      '2c 2d 2h 2s 3c',
      '5d 4d 3d 2d Ad',
    ]
    const scores = ordered.map(score)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i - 1])
    }
  })
})

describe('같은 족보끼리 비교', () => {
  it('휠(A-5)은 가장 낮은 스트레이트다', () => {
    expect(score('6c 5d 4h 3s 2c')).toBeGreaterThan(score('5c 4d 3h 2s Ac'))
  })

  it('A 하이 스트레이트가 가장 높다', () => {
    expect(score('Ac Kd Qh Js Tc')).toBeGreaterThan(score('Kc Qd Jh Ts 9c'))
  })

  it('페어가 같으면 키커로 가린다', () => {
    expect(score('Ac Ad Kh 7s 2c')).toBeGreaterThan(score('Ah As Qh Js Tc'))
    expect(score('Ac Ad Kh 7s 3c')).toBeGreaterThan(score('Ah As Kd 7c 2c'))
  })

  it('투페어는 높은 페어, 낮은 페어, 키커 순으로 비교한다', () => {
    expect(score('Kc Kd 2h 2s 3c')).toBeGreaterThan(score('Qc Qd Jh Js Ac'))
    expect(score('Kc Kd 5h 5s 3c')).toBeGreaterThan(score('Kh Ks 4h 4s Ac'))
    expect(score('Kc Kd 5h 5s 3c')).toBeGreaterThan(score('Kh Ks 5d 5c 2c'))
  })

  it('풀하우스는 트리플 랭크를 먼저 비교한다', () => {
    expect(score('3c 3d 3h 2s 2c')).toBeGreaterThan(score('2c 2d 2h As Ac'))
  })

  it('플러시는 높은 카드부터 차례로 비교한다', () => {
    expect(score('Ah Kh 4h 3h 2h')).toBeGreaterThan(score('As Qs Js Ts 8s'))
    expect(score('Ah Kh 5h 3h 2h')).toBeGreaterThan(score('As Ks 4s 3s 2s'))
  })

  it('무늬만 다른 같은 핸드는 비긴다', () => {
    expect(score('Ac Kd Qh 9s 7c')).toBe(score('Ad Kh Qs 9c 7d'))
  })
})

describe('6~7장에서 가장 좋은 5장 고르기', () => {
  it('세 개의 페어가 있으면 높은 두 페어와 가장 높은 키커를 쓴다', () => {
    // 3 페어 중 남은 페어(3)보다 Q가 더 높은 키커
    expect(score('Ac Ad Kc Kd 3h 3s Qc')).toBe(score('Ah As Kh Ks Qd'))
    // 남은 페어의 랭크가 다른 카드보다 높으면 그것이 키커가 된다
    expect(score('Ac Ad Kc Kd Qh Qs 2c')).toBe(score('Ah As Kh Ks Qd'))
  })

  it('트리플이 두 개면 높은 트리플 + 낮은 트리플의 페어로 풀하우스', () => {
    const s = score('9c 9d 9h 5c 5d 5h Ac')
    expect(categoryOf(s)).toBe(HandCategory.FullHouse)
    expect(s).toBe(score('9s 9d 9h 5s 5d'))
  })

  it('트리플 + 페어 두 개면 더 높은 페어를 쓴다', () => {
    expect(score('7c 7d 7h Kc Kd 2h 2s')).toBe(score('7s 7d 7h Ks Kd'))
  })

  it('6~7장의 같은 무늬 중 높은 5장으로 플러시를 만든다', () => {
    expect(score('Ah Kh 9h 7h 5h 3h 2h')).toBe(score('Ah Kh 9h 7h 5h'))
  })

  it('6장 연속이면 가장 높은 스트레이트를 쓴다', () => {
    expect(score('4c 5d 6h 7s 8c 9d 2h')).toBe(score('5c 6d 7h 8s 9c'))
  })

  it('플러시와 스트레이트가 따로 있으면 스트레이트 플러시가 아니다', () => {
    // 하트 플러시 + 5~9 스트레이트지만 같은 무늬로 이어지지 않음
    expect(category('5h 6h 7c 8h 9d Kh 2h')).toBe(HandCategory.Flush)
  })

  it('스트레이트 플러시 안에서 더 높은 일반 스트레이트를 무시한다', () => {
    // 하트 4~8 스트레이트 플러시, 9는 다른 무늬
    const s = score('4h 5h 6h 7h 8h 9c Tc')
    expect(categoryOf(s)).toBe(HandCategory.StraightFlush)
    expect(s).toBe(score('4d 5d 6d 7d 8d'))
  })

  it('포카드의 키커는 남은 카드 중 가장 높은 것', () => {
    expect(score('8c 8d 8h 8s Kc Kd 2c')).toBe(score('8c 8d 8h 8s Kh'))
  })

  it('5장, 6장, 7장 모두 판정한다', () => {
    expect(category('Ac Ad 2h 7s 9c')).toBe(HandCategory.OnePair)
    expect(category('Ac Ad 2h 7s 9c 9d')).toBe(HandCategory.TwoPair)
    expect(category('Ac Ad 2h 7s 9c 9d 9h')).toBe(HandCategory.FullHouse)
  })

  it('4장 이하, 8장 이상은 오류를 낸다', () => {
    expect(() => score('Ac Ad 2h 7s')).toThrow()
    expect(() => score('Ac Ad 2h 7s 9c 9d 9h Kc')).toThrow()
  })
})

describe('bestFiveCards', () => {
  it('evaluate와 같은 점수를 내고 실제 5장을 돌려준다', () => {
    const cards = parseCards('Kh Qh Jh Th 2c 3d Ah')
    const best = bestFiveCards(cards)
    expect(best.score).toBe(evaluate(cards))
    expect(cardsToString([...best.cards].sort((a, b) => b - a))).toBe('Ah Kh Qh Jh Th')
  })
})

describe('describeScore', () => {
  it.each([
    ['As Ks Qs Js Ts', '로열 플러시', 'A 하이'],
    ['9s 8s 7s 6s 5s', '스트레이트 플러시', '9 하이'],
    ['Kc Kd Kh 7s 7c', '풀하우스', 'K 풀 오브 7'],
    ['Jc Jd 4h 4s Ac', '투페어', 'J·4 투페어, 키커 A'],
    ['5c 4d 3h 2s Ac', '스트레이트', '5 하이'],
  ])('%s → %s (%s)', (hand, name, detail) => {
    expect(describeScore(score(hand))).toMatchObject({ name, detail })
  })
})

describe('전체 5장 조합 검증 (2,598,960가지)', () => {
  it('족보별 개수와 서로 다른 등급 수가 알려진 값과 일치한다', () => {
    const counts = new Array<number>(9).fill(0)
    const distinct = new Set<number>()
    const hand: Card[] = new Array(5)

    for (let a = 0; a < 52; a++) {
      hand[0] = a
      for (let b = a + 1; b < 52; b++) {
        hand[1] = b
        for (let c = b + 1; c < 52; c++) {
          hand[2] = c
          for (let d = c + 1; d < 52; d++) {
            hand[3] = d
            for (let e = d + 1; e < 52; e++) {
              hand[4] = e
              const s = evaluate(hand)
              counts[categoryOf(s)]++
              distinct.add(s)
            }
          }
        }
      }
    }

    expect(counts).toEqual([
      1_302_540, // 하이카드
      1_098_240, // 원페어
      123_552, // 투페어
      54_912, // 트리플
      10_200, // 스트레이트
      5_108, // 플러시
      3_744, // 풀하우스
      624, // 포카드
      40, // 스트레이트 플러시 (로열 포함)
    ])
    expect(distinct.size).toBe(7_462)
  }, 60_000)
})
