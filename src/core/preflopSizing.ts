/**
 * 프리플랍 표준 레이즈 사이즈 (BB 단위, "총 레이즈 금액" 기준)
 *
 * 널리 쓰이는 경험칙을 따른다. 솔버 결과가 아니라 출발점으로 쓰는 값이다.
 *   오픈: 온라인 2.5BB (SB 3BB), 라이브 3BB (SB 3.5BB), 림퍼 1명당 +1BB
 *   3벳: 포지션 있음 오픈의 3배, 없음 4배, 콜러 1명당 +오픈 1배
 *   4벳: 포지션 있음 3벳의 2.2배, 없음 2.5배
 *   레이즈가 유효 스택의 40%를 넘으면 올인이 낫다 (남은 스택으로 폴드하기 어려움)
 */

export const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const
export type Position = (typeof POSITIONS)[number]

export type GameStyle = 'online' | 'live'

export type PreflopSpot =
  | { kind: 'open'; position: Position; limpers: number; style: GameStyle; stack: number }
  | { kind: '3bet'; openSize: number; inPosition: boolean; callers: number; stack: number }
  | { kind: '4bet'; threeBetSize: number; inPosition: boolean; stack: number }

export interface PreflopAdvice {
  /** 총 레이즈 금액 (BB) */
  amount: number
  allIn: boolean
  reasons: string[]
}

/** 이 스택 이하에서는 오픈 대신 올인 또는 폴드 */
export const PUSH_FOLD_STACK = 15
/** 레이즈 금액이 스택의 이 비율을 넘으면 올인 */
export const COMMIT_RATIO = 0.4

const round = (x: number) => Math.round(x * 10) / 10

function finish(amount: number, stack: number, reasons: string[]): PreflopAdvice {
  if (amount >= stack * COMMIT_RATIO) {
    return {
      amount: stack,
      allIn: true,
      reasons: [
        ...reasons,
        `계산한 레이즈(${round(amount)} BB)가 스택의 ${Math.round(COMMIT_RATIO * 100)}% 이상이라, 남은 스택을 지키며 폴드하기 어려우므로 올인이 낫습니다.`,
      ],
    }
  }
  return { amount: round(amount), allIn: false, reasons }
}

export function preflopAdvice(spot: PreflopSpot): PreflopAdvice {
  if (spot.stack <= 0) throw new Error('유효 스택은 0보다 커야 합니다')

  if (spot.kind === 'open') {
    if (spot.stack <= PUSH_FOLD_STACK) {
      return {
        amount: spot.stack,
        allIn: true,
        reasons: [`유효 스택이 ${PUSH_FOLD_STACK} BB 이하라 작게 레이즈한 뒤 폴드할 여유가 없습니다. 올인 또는 폴드로 플레이하세요.`],
      }
    }
    const isSB = spot.position === 'SB'
    const base = spot.style === 'online' ? (isSB ? 3 : 2.5) : isSB ? 3.5 : 3
    const reasons = [
      `${spot.style === 'online' ? '온라인' : '라이브'} 게임 ${spot.position} 오픈의 표준 사이즈는 ${base} BB입니다.`,
    ]
    if (isSB) reasons.push('SB는 이후 모든 스트리트에서 포지션이 없으므로 조금 크게 열어 BB의 참여를 줄입니다.')
    if (spot.limpers > 0) reasons.push(`앞에 림퍼가 ${spot.limpers}명 있어 1명당 1 BB씩 더합니다.`)
    return finish(base + spot.limpers, spot.stack, reasons)
  }

  if (spot.kind === '3bet') {
    const mult = spot.inPosition ? 3 : 4
    const reasons = [
      spot.inPosition
        ? '포지션이 있으면(내가 나중에 행동) 오픈의 약 3배로 3벳합니다.'
        : '포지션이 없으면 플랍 이후가 불리하므로 오픈의 약 4배로 크게 3벳해 팟을 빨리 가져오거나 상대의 콜을 줄입니다.',
    ]
    if (spot.callers > 0) reasons.push(`오픈에 콜한 사람이 ${spot.callers}명 있어 1명당 오픈 금액만큼 더합니다.`)
    return finish(spot.openSize * (mult + spot.callers), spot.stack, reasons)
  }

  const mult = spot.inPosition ? 2.2 : 2.5
  return finish(spot.threeBetSize * mult, spot.stack, [
    spot.inPosition ? '포지션이 있으면 3벳의 약 2.2배로 4벳합니다.' : '포지션이 없으면 3벳의 약 2.5배로 4벳합니다.',
  ])
}
