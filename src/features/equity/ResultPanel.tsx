import { evaluate, CATEGORY_NAMES, HandCategory, describeScore } from '../../core/evaluator'
import type { Card } from '../../core/cards'
import type { Combo } from '../../core/equity'
import Panel from '../../components/Panel'
import PlayingCard from '../../components/PlayingCard'
import { count, pct } from '../../components/format'
import type { Opponent } from './store'
import type { EquityWorkerState } from './useEquityWorker'

interface ResultPanelProps {
  worker: EquityWorkerState
  message: string | null
  hero: Combo | null
  board: Card[]
  opponents: Opponent[]
}

export default function ResultPanel({ worker, message, hero, board, opponents }: ResultPanelProps) {
  const { result, status } = worker

  let body
  if (message) {
    body = <p className="py-6 text-center text-sm text-slate-500">{message}</p>
  } else if (status === 'error') {
    body = <p className="py-6 text-center text-sm text-red-600">{worker.error}</p>
  } else if (!result) {
    body = <p className="py-6 text-center text-sm text-slate-500">계산 중…</p>
  } else {
    const rows = [
      { label: '나', cards: hero as Card[] | null, hero: true },
      ...opponents.map((o, i) => ({
        label: `상대 ${i + 1}`,
        cards: o.mode === 'hand' ? (o.cards as Card[]) : null,
        hero: false,
      })),
    ]
    body = (
      <div className={`space-y-3 transition-opacity ${status === 'running' ? 'opacity-70' : ''}`}>
        <ul className="space-y-2.5">
          {rows.map((row, i) => {
            const p = result.players[i]
            if (!p) return null
            return (
              <li key={i}>
                <div className="mb-1 flex items-center gap-2">
                  <span className={`w-12 text-sm ${row.hero ? 'font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                    {row.label}
                  </span>
                  <span className="flex gap-0.5">
                    {row.cards ? (
                      row.cards.map((c) => <PlayingCard key={c} card={c} size="sm" />)
                    ) : (
                      <span className="text-xs text-slate-400">랜덤</span>
                    )}
                  </span>
                  <span className={`ml-auto tabular-nums ${row.hero ? 'text-2xl font-bold' : 'text-lg font-semibold'}`}>
                    {pct(p.equity)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${row.hero ? 'bg-felt-500' : 'bg-slate-400 dark:bg-slate-500'}`}
                    style={{ width: pct(p.equity) }}
                  />
                </div>
                <p className="mt-0.5 text-right text-[11px] text-slate-500 tabular-nums">
                  승 {pct(p.win)} · 무 {pct(p.tie)}
                </p>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-slate-500">
          {result.exact
            ? `정확 계산 · 모든 경우 ${count(result.samples)}가지`
            : `시뮬레이션 · ${count(result.samples)}회${status === 'running' ? ' (계산 중…)' : ''}`}
        </p>
      </div>
    )
  }

  return (
    <Panel title="승률">
      {body}
      {hero && board.length >= 3 && <CurrentHand hero={hero} board={board} />}
      {!message && result && board.length < 5 && <CategoryDistribution distribution={result.heroCategories} />}
    </Panel>
  )
}

function CurrentHand({ hero, board }: { hero: Combo; board: Card[] }) {
  const d = describeScore(evaluate([...hero, ...board]))
  return (
    <p className="mt-4 rounded-lg bg-felt-50 px-3 py-2 text-sm dark:bg-felt-900/40">
      현재 내 패: <strong>{d.name}</strong> <span className="text-slate-500">({d.detail})</span>
    </p>
  )
}

const CATEGORY_ORDER = [
  HandCategory.StraightFlush,
  HandCategory.FourOfAKind,
  HandCategory.FullHouse,
  HandCategory.Flush,
  HandCategory.Straight,
  HandCategory.ThreeOfAKind,
  HandCategory.TwoPair,
  HandCategory.OnePair,
  HandCategory.HighCard,
]

function CategoryDistribution({ distribution }: { distribution: number[] }) {
  const max = Math.max(...distribution)
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium text-slate-500">리버까지 내가 완성할 족보</p>
      <ul className="space-y-1">
        {CATEGORY_ORDER.filter((c) => distribution[c] > 0).map((c) => (
          <li key={c} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 text-slate-600 dark:text-slate-300">{CATEGORY_NAMES[c]}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-felt-500/70" style={{ width: pct(distribution[c] / max) }} />
            </div>
            <span className="w-12 text-right tabular-nums">{pct(distribution[c])}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
