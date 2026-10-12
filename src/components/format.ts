export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`
}

export function count(n: number): string {
  return n.toLocaleString('ko-KR')
}

export function bb(x: number): string {
  const rounded = Math.round(x * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded} BB`
}
