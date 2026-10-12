import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import PlayingCard from '../../components/PlayingCard'
import Segmented from '../../components/Segmented'
import { db, deleteHandsBySource } from '../../db'
import type { StoredHand } from '../../core/history'
import { formatDateTime, netClass, netText } from './format'

type Filter = 'all' | StoredHand['source']

const SOURCE_LABELS: Record<StoredHand['source'], string> = { practice: '연습', manual: '직접 입력' }

const buttonClass =
  'rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

/** 한 번에 보여주는 최대 개수 */
const PAGE = 200

export default function HandList() {
  const [filter, setFilter] = useState<Filter>('all')
  const hands = useLiveQuery(async () => {
    const all = await db.hands.orderBy('createdAt').reverse().toArray()
    return filter === 'all' ? all : all.filter((h) => h.source === filter)
  }, [filter])

  const total = hands?.reduce((sum, h) => sum + h.heroNet, 0) ?? 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="출처"
          value={filter}
          options={[
            { value: 'all', label: '전체' },
            { value: 'practice', label: '연습' },
            { value: 'manual', label: '직접 입력' },
          ]}
          onChange={setFilter}
        />
        <Link to="/hands/new" className="rounded-md bg-felt-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-felt-700">
          + 핸드 입력
        </Link>
        <button
          type="button"
          className={`${buttonClass} ml-auto`}
          onClick={() => confirm('연습 게임에서 저장된 핸드를 모두 지울까요?') && deleteHandsBySource('practice')}
        >
          연습 핸드 모두 삭제
        </button>
      </div>

      {hands === undefined ? (
        <p className="py-6 text-center text-sm text-slate-500">불러오는 중…</p>
      ) : hands.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">
          기록한 핸드가 없어요. 연습 게임을 하면 자동으로 저장되고, “+ 핸드 입력”으로 실전 핸드를 남길 수 있어요.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {hands.length}핸드 · 합계 <span className={netClass(total)}>{netText(total)}</span>
          </p>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {hands.slice(0, PAGE).map((h) => (
              <li key={h.id}>
                <HandRow hand={h} />
              </li>
            ))}
          </ul>
          {hands.length > PAGE && <p className="text-xs text-slate-500">최근 {PAGE}개만 표시합니다.</p>}
        </>
      )}
    </div>
  )
}

function HandRow({ hand }: { hand: StoredHand }) {
  const mistakes = hand.practice?.feedback.filter((f) => f.verdict === 'mistake').length ?? 0
  return (
    <Link to={`/hands/${hand.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <div className="flex gap-0.5">
        {hand.heroCards.map((c) => (
          <PlayingCard key={c} card={c} size="sm" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span>{formatDateTime(hand.createdAt)}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{SOURCE_LABELS[hand.source]}</span>
          <span>
            {hand.heroPosition}
            {hand.villainPosition ? ` vs ${hand.villainPosition}` : ''}
          </span>
          {mistakes > 0 && <span className="text-rose-600">실수 {mistakes}</span>}
        </p>
        <div className="mt-0.5 flex gap-0.5">
          {hand.board.map((c) => (
            <PlayingCard key={c} card={c} size="sm" />
          ))}
          {hand.board.length === 0 && <span className="text-xs text-slate-400">보드 없음 (프리플랍 종료)</span>}
        </div>
      </div>
      <span className={`text-sm font-semibold tabular-nums ${netClass(hand.heroNet)}`}>{netText(hand.heroNet)}</span>
    </Link>
  )
}
