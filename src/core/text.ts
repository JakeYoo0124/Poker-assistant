/** core에서 쓰는 간단한 표시용 서식 (UI 의존 없음) */
export function pctText(x: number): string {
  return `${Math.round(x * 1000) / 10}%`
}
