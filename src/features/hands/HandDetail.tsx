import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import Panel from '../../components/Panel'
import PlayingCard from '../../components/PlayingCard'
import { BOT_PROFILES, type BotProfileId } from '../../core/bot'
import { describeScore, evaluate } from '../../core/evaluator'
import { STREET_LABELS, actionLabel, replaySteps, type StoredHand } from '../../core/history'
import { db, deleteHand, updateHand } from '../../db'
import { formatDateTime, netClass, netText } from './format'

const VERDICT_LABELS = { good: '좋음', ok: '괜찮음', mistake: '실수' } as const
const VERDICT_CLASSES = {
  good: 'text-emerald-600 dark:text-emerald-400',
  ok: 'text-amber-600 dark:text-amber-400',
  mistake: 'text-rose-600 dark:text-rose-400',
} as const

const navButton =
  'rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800'

export default function HandDetail() {
  const { id } = useParams()
  const handId = Number(id)
  const hand = useLiveQuery(() => db.hands.get(handId), [handId])
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray(), [])
  const navigate = useNavigate()

  if (hand === undefined) {
    return <p className="py-10 text-center text-sm text-slate-500">불러오는 중이거나 없는 핸드입니다.</p>
  }

  const remove = async () => {
    if (!confirm('이 핸드를 삭제할까요?')) return
    await deleteHand(handId)
    navigate('/hands')
  }

  const profileName = hand.practice ? (BOT_PROFILES[hand.practice.profileId as BotProfileId]?.name ?? hand.practice.profileId) : null

  return (
    <>
      <PageHeader
        title="핸드 복기"
        description={`${formatDateTime(hand.createdAt)} · ${hand.source === 'practice' ? `연습 게임 (AI: ${profileName})` : '직접 입력'}`}
      />
      <div className="mb-4 flex items-center gap-2">
        <Link to="/hands" className="text-sm text-felt-600 hover:underline">
          ← 핸드 기록으로
        </Link>
        <button type="button" onClick={remove} className="ml-auto rounded-md px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950">
          삭제
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Replay hand={hand} />

        <div className="space-y-4">
          <Panel title="요약">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-slate-500">포지션</dt>
              <dd>
                나 {hand.heroPosition}
                {hand.villainPosition && ` vs 상대 ${hand.villainPosition}`}
              </dd>
              <dt className="text-slate-500">유효 스택</dt>
              <dd>{hand.effectiveStack} BB</dd>
              <dt className="text-slate-500">결과</dt>
              <dd className={`font-semibold ${netClass(hand.heroNet)}`}>{netText(hand.heroNet)}</dd>
            </dl>
            <label className="mt-3 block text-xs text-slate-500">
              세션
              <select
                value={hand.sessionId ?? ''}
                onChange={(e) => updateHand(handId, { sessionId: e.target.value ? Number(e.target.value) : null })}
                className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">세션 없음</option>
                {sessions?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.date} · {s.venue || '(장소 없음)'}
                  </option>
                ))}
              </select>
            </label>
            <Notes key={hand.id} hand={hand} />
          </Panel>

          {hand.practice && (
            <Panel title="코치 피드백">
              {hand.practice.feedback.length === 0 ? (
                <p className="text-sm text-slate-500">저장된 피드백이 없어요.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {hand.practice.feedback.map((f, i) => (
                    <li key={i}>
                      <span className="text-xs text-slate-500">{STREET_LABELS[f.street]} </span>
                      <span className={`font-semibold ${VERDICT_CLASSES[f.verdict]}`}>{VERDICT_LABELS[f.verdict]}</span> · 내 선택{' '}
                      {f.chosen} · 추천 {f.recommended}
                      {f.evLoss !== null && f.evLoss > 0.05 && <span className="text-rose-600"> (−{f.evLoss.toFixed(2)} BB)</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}

function Notes({ hand }: { hand: StoredHand }) {
  const [text, setText] = useState(hand.notes)
  return (
    <label className="mt-3 block text-xs text-slate-500">
      메모 (입력란을 벗어나면 저장)
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== hand.notes && updateHand(hand.id!, { notes: text })}
        rows={3}
        className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
    </label>
  )
}

function Replay({ hand }: { hand: StoredHand }) {
  const steps = replaySteps(hand)
  const [index, setIndex] = useState(steps.length - 1)
  const step = steps[Math.min(index, steps.length - 1)]

  const handName = (cards: number[]) =>
    cards.length === 2 && step.board.length >= 3 ? describeScore(evaluate([...cards, ...step.board])).name : null

  const seat = (label: string, cards: number[] | null, bet: number) => (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {cards ? (
          cards.map((c) => <PlayingCard key={c} card={c} />)
        ) : (
          <span className="text-sm text-felt-100/80">카드 모름</span>
        )}
      </div>
      <div className="text-sm text-white">
        <p className="font-semibold">{label}</p>
        {cards && handName(cards) && <p className="text-xs text-felt-100/80">{handName(cards)}</p>}
        {bet > 0 && <p className="text-xs text-amber-200 tabular-nums">베팅 {bet} BB</p>}
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="space-y-4 rounded-2xl border-4 border-felt-900 bg-felt-700 p-4">
        {seat(`상대${hand.villainPosition ? ` (${hand.villainPosition})` : ''}`, hand.villainCards, step.committed.villain)}
        <div className="flex flex-col items-center gap-2 py-1">
          <div className="flex gap-1">
            {Array.from({ length: 5 }, (_, i) =>
              step.board[i] !== undefined ? (
                <PlayingCard key={step.board[i]} card={step.board[i]} />
              ) : (
                <span key={`empty-${i}`} className="h-14 w-10 rounded-md border border-dashed border-felt-500/60" />
              ),
            )}
          </div>
          <p className="rounded-full bg-felt-900/60 px-3 py-0.5 text-sm font-semibold text-white tabular-nums">
            {STREET_LABELS[step.street]} · 팟 {step.pot} BB
          </p>
        </div>
        {seat(`나 (${hand.heroPosition})`, hand.heroCards, step.committed.hero)}
      </div>

      <div className="flex items-center gap-1.5">
        <button type="button" className={navButton} onClick={() => setIndex(0)} disabled={index === 0} aria-label="처음으로">
          ⏮
        </button>
        <button type="button" className={navButton} onClick={() => setIndex(index - 1)} disabled={index === 0} aria-label="이전 단계">
          ◀
        </button>
        <span className="flex-1 text-center text-sm">
          {step.action ? (
            <>
              <strong>{step.action.actor === 'hero' ? '나' : '상대'}</strong>: {actionLabel(step.action)}
            </>
          ) : index === 0 ? (
            '블라인드'
          ) : (
            '남은 보드 공개'
          )}
          <span className="ml-2 text-xs text-slate-500">
            {index + 1} / {steps.length}
          </span>
        </span>
        <button
          type="button"
          className={navButton}
          onClick={() => setIndex(index + 1)}
          disabled={index >= steps.length - 1}
          aria-label="다음 단계"
        >
          ▶
        </button>
        <button
          type="button"
          className={navButton}
          onClick={() => setIndex(steps.length - 1)}
          disabled={index >= steps.length - 1}
          aria-label="끝으로"
        >
          ⏭
        </button>
      </div>

      <Panel title="액션 전체">
        <ol className="space-y-0.5 text-sm">
          {hand.actions.map((a, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setIndex(i + 1)}
                className={`flex w-full gap-2 rounded px-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  index === i + 1 ? 'bg-felt-50 dark:bg-felt-900/40' : ''
                }`}
              >
                <span className="w-14 shrink-0 text-xs leading-5 text-slate-400">{STREET_LABELS[a.street]}</span>
                <span className={a.actor === 'hero' ? 'font-medium' : 'text-slate-600 dark:text-slate-300'}>
                  {a.actor === 'hero' ? '나' : '상대'}: {actionLabel(a)}
                </span>
              </button>
            </li>
          ))}
          {hand.actions.length === 0 && <li className="text-xs text-slate-400">기록된 액션이 없어요.</li>}
        </ol>
      </Panel>
    </div>
  )
}
