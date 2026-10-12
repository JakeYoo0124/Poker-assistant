import { useMemo } from 'react'
import type { Card } from '../../core/cards'
import { calculateOuts, type Combo } from '../../core/equity'
import Panel from '../../components/Panel'
import PlayingCard from '../../components/PlayingCard'
import { pct } from '../../components/format'

interface OutsPanelProps {
  hero: Combo
  opponents: Combo[]
  board: Card[]
}

const STATUS_TEXT = {
  ahead: '지금은 내가 앞서 있어요',
  tied: '지금은 비기는 상황이에요',
  behind: '지금은 내가 뒤처져 있어요',
} as const

/** 상대 핸드를 모두 알고, 플랍 또는 턴일 때만 표시한다 */
export default function OutsPanel({ hero, opponents, board }: OutsPanelProps) {
  const outs = useMemo(() => calculateOuts(hero, opponents, board), [hero, opponents, board])
  const nextStreet = board.length === 3 ? '턴' : '리버'

  const group = (title: string, cards: Card[], tone: string) =>
    cards.length > 0 && (
      <div>
        <p className={`mb-1 text-xs font-medium ${tone}`}>
          {title} {cards.length}장 · {nextStreet}에 나올 확률 {pct(cards.length / outs.remaining)}
        </p>
        <div className="flex flex-wrap gap-0.5">
          {cards.map((c) => (
            <PlayingCard key={c} card={c} size="sm" />
          ))}
        </div>
      </div>
    )

  return (
    <Panel title={`다음 카드 (${nextStreet})`}>
      <p className="mb-3 text-sm font-medium">{STATUS_TEXT[outs.status]}</p>
      <div className="space-y-3">
        {outs.status === 'ahead' ? (
          <>
            {group('위험 카드', outs.losing, 'text-red-600 dark:text-red-400')}
            {group('비기게 되는 카드', outs.tying, 'text-slate-500')}
            {outs.losing.length === 0 && outs.tying.length === 0 && (
              <p className="text-xs text-slate-500">어떤 카드가 나와도 앞서요.</p>
            )}
          </>
        ) : (
          <>
            {group('아웃츠 (이기게 되는 카드)', outs.winning, 'text-felt-600 dark:text-felt-100')}
            {group('비기게 되는 카드', outs.tying, 'text-slate-500')}
            {outs.winning.length === 0 && <p className="text-xs text-slate-500">다음 한 장으로 역전할 카드가 없어요.</p>}
          </>
        )}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">다음 한 장만 고려합니다. 턴·리버 연속으로 맞는 경우는 승률에 포함돼요.</p>
    </Panel>
  )
}
