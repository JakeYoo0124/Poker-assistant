export function netText(bb: number): string {
  const r = Math.round(bb * 100) / 100
  return `${r > 0 ? '+' : ''}${r} BB`
}

export function netClass(bb: number): string {
  if (bb > 0) return 'text-felt-600 dark:text-felt-100'
  if (bb < 0) return 'text-rose-600 dark:text-rose-400'
  return 'text-slate-500'
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function todayISODate(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function won(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}
