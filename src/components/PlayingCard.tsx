import { SUIT_SYMBOLS, suitOf, type Card } from '../core/cards'
import { SUIT_TEXT_CLASSES, cardAriaLabel, rankLabel } from './cardStyle'

const SIZE_CLASSES = {
  sm: 'h-10 w-7 text-sm',
  md: 'h-14 w-10 text-lg',
} as const

interface PlayingCardProps {
  card: Card | null
  size?: keyof typeof SIZE_CLASSES
  active?: boolean
  onClick?: () => void
  /** 빈 칸일 때의 접근성 이름 */
  emptyLabel?: string
}

/** 카드 한 장 또는 빈 칸. onClick이 있으면 버튼으로 렌더링한다. */
export default function PlayingCard({ card, size = 'md', active = false, onClick, emptyLabel = '빈 칸' }: PlayingCardProps) {
  const base = `${SIZE_CLASSES[size]} inline-flex shrink-0 flex-col items-center justify-center rounded-md border font-bold leading-none transition-colors`
  const ring = active ? 'ring-2 ring-felt-500 ring-offset-1 dark:ring-offset-slate-900' : ''
  const face =
    card === null
      ? 'border-dashed border-slate-300 bg-slate-100 text-slate-400 dark:border-slate-600 dark:bg-slate-800'
      : `border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800 ${SUIT_TEXT_CLASSES[suitOf(card)]}`

  const content =
    card === null ? (
      <span aria-hidden>+</span>
    ) : (
      <>
        <span>{rankLabel(card)}</span>
        <span aria-hidden>{SUIT_SYMBOLS[suitOf(card)]}</span>
      </>
    )
  const label = card === null ? emptyLabel : cardAriaLabel(card)

  if (!onClick) {
    return (
      <span className={`${base} ${face}`} role="img" aria-label={label}>
        {content}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`${base} ${face} ${ring} hover:border-felt-500`}
    >
      {content}
    </button>
  )
}
