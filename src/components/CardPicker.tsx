import { SUIT_SYMBOLS, makeCard, type Card } from '../core/cards'
import { SUIT_TEXT_CLASSES, cardAriaLabel, rankLabel } from './cardStyle'

/** 위에서부터 ♠ ♥ ♦ ♣, 왼쪽부터 A → 2 */
const SUIT_ROWS = [3, 2, 1, 0]
const RANK_COLUMNS = Array.from({ length: 13 }, (_, i) => 12 - i)

interface CardPickerProps {
  /** 이미 다른 칸에서 쓰고 있는 카드 (선택 불가) */
  disabled: Set<Card>
  /** 현재 선택된 칸에 들어 있는 카드 (강조 표시) */
  selected: Card | null
  onPick: (card: Card) => void
}

export default function CardPicker({ disabled, selected, onPick }: CardPickerProps) {
  return (
    <div className="grid grid-cols-13 gap-0.5 sm:gap-1" role="grid" aria-label="카드 선택">
      {SUIT_ROWS.map((suit) =>
        RANK_COLUMNS.map((rank) => {
          const card = makeCard(rank, suit)
          const isSelected = card === selected
          const isDisabled = disabled.has(card) && !isSelected
          const rankText = rankLabel(card)
          return (
            <button
              key={card}
              type="button"
              disabled={isDisabled}
              onClick={() => onPick(card)}
              aria-label={cardAriaLabel(card)}
              aria-pressed={isSelected}
              className={`flex aspect-[3/4] flex-col items-center justify-center rounded border text-[11px] font-bold leading-none sm:text-sm ${
                SUIT_TEXT_CLASSES[suit]
              } ${
                isSelected
                  ? 'border-felt-500 bg-felt-50 ring-2 ring-felt-500 dark:bg-felt-900'
                  : 'border-slate-200 bg-white hover:border-felt-500 dark:border-slate-700 dark:bg-slate-800'
              } disabled:cursor-not-allowed disabled:opacity-20`}
            >
              <span className="tracking-tighter">{rankText}</span>
              <span aria-hidden>{SUIT_SYMBOLS[suit]}</span>
            </button>
          )
        }),
      )}
    </div>
  )
}
