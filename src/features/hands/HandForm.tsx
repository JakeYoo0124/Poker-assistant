import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CardPicker from '../../components/CardPicker'
import NumberField from '../../components/NumberField'
import PageHeader from '../../components/PageHeader'
import Panel from '../../components/Panel'
import PlayingCard from '../../components/PlayingCard'
import Segmented from '../../components/Segmented'
import type { Card } from '../../core/cards'
import type { Street } from '../../core/game'
import {
  STREETS,
  STREET_LABELS,
  TABLE_POSITIONS,
  actionLabel,
  playActions,
  potTotal,
  suggestedNet,
  toCall,
  type Actor,
  type HistoryAction,
  type TablePosition,
} from '../../core/history'
import { addHand, db } from '../../db'
import { netText } from './format'

/** 슬롯: 0~1 내 핸드, 2~3 상대 핸드, 4~8 보드 */
const SLOTS = 9
const BOARD_START = 4

const selectClass =
  'mt-1 block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
const smallButton =
  'rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'

export default function HandForm() {
  const navigate = useNavigate()
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray(), [])

  const [heroPosition, setHeroPosition] = useState<TablePosition>('BTN')
  const [villainPosition, setVillainPosition] = useState<TablePosition>('BB')
  const [effectiveStack, setEffectiveStack] = useState(100)
  const [cards, setCards] = useState<(Card | null)[]>(Array(SLOTS).fill(null))
  const [active, setActive] = useState<number | null>(0)
  const [actions, setActions] = useState<HistoryAction[]>([])
  const [street, setStreet] = useState<Street>('preflop')
  const [amount, setAmount] = useState(2.5)
  const [heroNet, setHeroNet] = useState<number | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const hand = { heroPosition, villainPosition, actions }
  const st = playActions(hand)
  const sameStreet = st.street === street
  const owed = (actor: Actor) => (sameStreet ? toCall(st, actor) : 0)
  const currentBet = sameStreet ? st.currentBet : 0
  const ended = st.folded !== null

  const pick = (card: Card) => {
    if (active === null) return
    if (cards.includes(card) && cards[active] !== card) return
    const next = [...cards]
    next[active] = card
    setCards(next)
    const after = next.findIndex((c, i) => i > active && c === null)
    setActive(after === -1 ? null : after)
  }

  const add = (actor: Actor, type: HistoryAction['type']) => {
    let value = 0
    if (type === 'call') value = owed(actor)
    if (type === 'bet' || type === 'raise') value = amount
    const committed = sameStreet ? st.committed[actor] : 0
    const added = type === 'call' ? value : type === 'bet' || type === 'raise' ? value - committed : 0
    const allIn = added > 0 && st.invested[actor] + added >= effectiveStack - 1e-9
    setActions([...actions, { street, actor, type, amount: value, allIn }])
    setHeroNet(null)
  }

  const save = async () => {
    const hero = cards.slice(0, 2)
    if (hero.some((c) => c === null)) return setError('내 핸드 2장을 골라 주세요.')
    if (heroNet === null) return setError('결과(손익)를 정해 주세요.')
    const villain = cards.slice(2, 4)
    const id = await addHand({
      createdAt: new Date().toISOString(),
      source: 'manual',
      sessionId,
      heroPosition,
      villainPosition,
      effectiveStack,
      heroCards: hero as Card[],
      villainCards: villain.every((c) => c !== null) ? (villain as Card[]) : null,
      board: cards.slice(BOARD_START).filter((c): c is Card => c !== null),
      actions,
      heroNet,
      notes,
    })
    navigate(`/hands/${id}`)
  }

  const slot = (i: number, label: string) => (
    <PlayingCard card={cards[i]} active={active === i} onClick={() => setActive(i)} emptyLabel={label} />
  )

  const actorRow = (actor: Actor) => {
    const due = owed(actor)
    const disabled = ended
    const raiseType = currentBet === 0 ? 'bet' : 'raise'
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-10 text-sm font-medium">{actor === 'hero' ? '나' : '상대'}</span>
        <button type="button" className={smallButton} disabled={disabled || due === 0} onClick={() => add(actor, 'fold')}>
          폴드
        </button>
        {due === 0 ? (
          <button type="button" className={smallButton} disabled={disabled} onClick={() => add(actor, 'check')}>
            체크
          </button>
        ) : (
          <button type="button" className={smallButton} disabled={disabled} onClick={() => add(actor, 'call')}>
            콜 {due}
          </button>
        )}
        <button
          type="button"
          className={smallButton}
          disabled={disabled || !(amount > currentBet)}
          onClick={() => add(actor, raiseType)}
        >
          {raiseType === 'bet' ? '베팅' : '레이즈'} {amount}
        </button>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="핸드 입력" description="실전에서 플레이한 핸드를 기록합니다. 금액은 모두 BB 단위예요." />
      <Link to="/hands" className="mb-4 inline-block text-sm text-felt-600 hover:underline">
        ← 핸드 기록으로
      </Link>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="상황과 카드">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs text-slate-500">
                내 포지션
                <select value={heroPosition} onChange={(e) => setHeroPosition(e.target.value as TablePosition)} className={selectClass}>
                  {TABLE_POSITIONS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-500">
                상대 포지션
                <select value={villainPosition} onChange={(e) => setVillainPosition(e.target.value as TablePosition)} className={selectClass}>
                  {TABLE_POSITIONS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <NumberField label="유효 스택 (BB)" value={effectiveStack} step={1} onChange={setEffectiveStack} />
            </div>

            <div className="flex flex-wrap gap-5">
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">내 핸드</p>
                <div className="flex gap-1">
                  {slot(0, '내 핸드 첫 번째 카드')}
                  {slot(1, '내 핸드 두 번째 카드')}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">상대 핸드 (알면)</p>
                <div className="flex gap-1">
                  {slot(2, '상대 핸드 첫 번째 카드')}
                  {slot(3, '상대 핸드 두 번째 카드')}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">보드</p>
                <div className="flex gap-1">
                  {[4, 5, 6, 7, 8].map((i) => (
                    <span key={i} className={i >= 7 ? 'ml-1' : ''}>
                      {slot(i, `보드 ${i - 3}번째 카드`)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-slate-500">선택한 칸에 넣을 카드를 고르세요</p>
                <button
                  type="button"
                  className={smallButton}
                  disabled={active === null || cards[active] === null}
                  onClick={() => {
                    if (active === null) return
                    const next = [...cards]
                    next[active] = null
                    setCards(next)
                  }}
                >
                  이 칸 지우기
                </button>
              </div>
              <CardPicker
                disabled={new Set(cards.filter((c): c is Card => c !== null))}
                selected={active === null ? null : cards[active]}
                onPick={pick}
              />
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="액션">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  label="스트리트"
                  value={street}
                  options={STREETS.map((s) => ({ value: s, label: STREET_LABELS[s] }))}
                  onChange={setStreet}
                />
                <span className="text-xs text-slate-500 tabular-nums">팟 {potTotal(st)} BB</span>
              </div>
              {STREETS.indexOf(street) < STREETS.indexOf(st.street) && (
                <p className="text-xs text-amber-600">이미 지나간 스트리트예요. 액션은 순서대로 입력해 주세요.</p>
              )}
              <div className="w-40">
                <NumberField label="베팅·레이즈 금액 (총액, BB)" value={amount} onChange={setAmount} />
              </div>
              {actorRow('hero')}
              {actorRow('villain')}

              <ol className="space-y-0.5 border-t border-slate-100 pt-2 text-sm dark:border-slate-800">
                {actions.length === 0 && <li className="text-xs text-slate-400">아직 입력한 액션이 없어요. 블라인드는 포지션에 맞춰 자동으로 들어갑니다.</li>}
                {actions.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-14 shrink-0 text-xs leading-5 text-slate-400">{STREET_LABELS[a.street]}</span>
                    <span className={a.actor === 'hero' ? 'font-medium' : 'text-slate-600 dark:text-slate-300'}>
                      {a.actor === 'hero' ? '나' : '상대'}: {actionLabel(a)}
                    </span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className={smallButton}
                disabled={actions.length === 0}
                onClick={() => {
                  setActions(actions.slice(0, -1))
                  setHeroNet(null)
                }}
              >
                마지막 액션 취소
              </button>
            </div>
          </Panel>

          <Panel title="결과와 저장">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ['win', '이김'],
                    ['lose', '짐'],
                    ['split', '스플릿'],
                  ] as const
                ).map(([o, label]) => (
                  <button key={o} type="button" className={smallButton} onClick={() => setHeroNet(suggestedNet(hand, o))}>
                    {label}
                  </button>
                ))}
                <span className="ml-1 text-xs text-slate-500">→ 입력한 액션으로 손익을 계산해요</span>
              </div>
              <div className="w-40">
                <NumberField label="내 손익 (BB)" value={heroNet ?? NaN} min={-10000} onChange={setHeroNet} />
              </div>
              {heroNet !== null && <p className="text-sm">이번 핸드: {netText(heroNet)}</p>}

              <label className="block text-xs text-slate-500">
                세션 (선택)
                <select
                  value={sessionId ?? ''}
                  onChange={(e) => setSessionId(e.target.value ? Number(e.target.value) : null)}
                  className={selectClass}
                >
                  <option value="">세션 없음</option>
                  {sessions?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.date} · {s.venue || '(장소 없음)'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-500">
                메모
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={selectClass} />
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="button" onClick={save} className="rounded-md bg-felt-600 px-4 py-2 text-sm font-semibold text-white hover:bg-felt-700">
                저장
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}
