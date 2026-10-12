/**
 * 팟 오즈
 *
 * pot  = 내가 콜하기 직전의 팟 (상대의 베팅 포함)
 * call = 내가 콜하려면 내야 하는 금액
 */

/** 콜이 본전이 되기 위해 필요한 최소 승률 = call / (pot + call) */
export function requiredEquity(pot: number, call: number): number {
  if (call <= 0) return 0
  return call / (pot + call)
}

/** 콜했을 때의 기대값 = 에퀴티 × (pot + call) − call. 이후 추가 베팅은 고려하지 않는다. */
export function callEV(equity: number, pot: number, call: number): number {
  return equity * (pot + call) - call
}

/** "팟 오즈 3 : 1" 같은 비율의 앞 숫자 = pot / call */
export function potOddsRatio(pot: number, call: number): number {
  if (call <= 0) return Infinity
  return pot / call
}
