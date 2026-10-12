import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import NumberField from '../../components/NumberField'
import Panel from '../../components/Panel'
import Segmented from '../../components/Segmented'
import { sessionProfit, sessionProfitBB, type StoredSession } from '../../core/history'
import { addSession, db, deleteSession } from '../../db'
import { netClass, netText, todayISODate, won } from './format'

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

const emptySession = (): StoredSession => ({
  date: todayISODate(),
  kind: 'live',
  venue: '',
  stakes: '',
  bbValue: 0,
  buyIn: 0,
  cashOut: 0,
  hours: 0,
  notes: '',
})

export default function SessionList() {
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray(), [])
  const handCounts = useLiveQuery(async () => {
    const counts = new Map<number, number>()
    await db.hands.where('sessionId').above(0).each((h) => counts.set(h.sessionId!, (counts.get(h.sessionId!) ?? 0) + 1))
    return counts
  }, [])
  const [draft, setDraft] = useState<StoredSession | null>(null)

  const totalProfit = sessions?.reduce((s, x) => s + sessionProfit(x), 0) ?? 0
  const totalHours = sessions?.reduce((s, x) => s + x.hours, 0) ?? 0

  return (
    <div className="space-y-4">
      {draft ? (
        <SessionForm
          draft={draft}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={async () => {
            await addSession(draft)
            setDraft(null)
          }}
        />
      ) : (
        <button
          type="button"
          className="rounded-md bg-felt-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-felt-700"
          onClick={() => setDraft(emptySession())}
        >
          + 세션 추가
        </button>
      )}

      {sessions && sessions.length > 0 && (
        <p className="text-xs text-slate-500">
          {sessions.length}세션 · 총 {totalHours}시간 · 합계{' '}
          <span className={netClass(totalProfit)}>{totalProfit >= 0 ? '+' : ''}{won(totalProfit)}</span>
        </p>
      )}

      {sessions?.length === 0 && !draft && (
        <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">
          기록한 세션이 없어요. 실전에서 플레이한 날의 바이인·캐시아웃을 남겨 보세요.
        </p>
      )}

      <ul className="space-y-2">
        {sessions?.map((s) => {
          const profit = sessionProfit(s)
          const bb = sessionProfitBB(s)
          return (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {s.date} · {s.venue || '(장소 없음)'}
                </p>
                <p className="text-xs text-slate-500">
                  {s.kind === 'live' ? '라이브' : '온라인'}
                  {s.stakes && ` · ${s.stakes}`}
                  {s.hours > 0 && ` · ${s.hours}시간`}
                  {` · 핸드 ${handCounts?.get(s.id!) ?? 0}개`}
                  {s.notes && ` · ${s.notes}`}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-semibold tabular-nums ${netClass(profit)}`}>
                  {profit >= 0 ? '+' : ''}
                  {won(profit)}
                </p>
                {s.bbValue > 0 && (
                  <p className={`text-xs tabular-nums ${netClass(bb)}`}>
                    {netText(bb)}
                    {s.hours > 0 && ` · ${(bb / s.hours).toFixed(1)} BB/시간`}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label={`${s.date} 세션 삭제`}
                className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                onClick={() => confirm('이 세션을 삭제할까요? 연결된 핸드는 남아요.') && deleteSession(s.id!)}
              >
                ✕
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

interface SessionFormProps {
  draft: StoredSession
  onChange: (s: StoredSession) => void
  onSave: () => void
  onCancel: () => void
}

function SessionForm({ draft, onChange, onSave, onCancel }: SessionFormProps) {
  const set = (patch: Partial<StoredSession>) => onChange({ ...draft, ...patch })
  return (
    <Panel title="새 세션">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-500">
          날짜
          <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className={inputClass} />
        </label>
        <div>
          <p className="mb-1 text-xs text-slate-500">종류</p>
          <Segmented
            label="종류"
            value={draft.kind}
            options={[
              { value: 'live', label: '라이브' },
              { value: 'online', label: '온라인' },
            ]}
            onChange={(kind) => set({ kind })}
          />
        </div>
        <label className="text-xs text-slate-500">
          장소 / 사이트
          <input value={draft.venue} onChange={(e) => set({ venue: e.target.value })} className={inputClass} />
        </label>
        <label className="text-xs text-slate-500">
          블라인드 (예: 1000/2000)
          <input value={draft.stakes} onChange={(e) => set({ stakes: e.target.value })} className={inputClass} />
        </label>
        <NumberField label="1 BB 금액 (원, BB 환산용)" value={draft.bbValue} step={100} onChange={(bbValue) => set({ bbValue })} />
        <NumberField label="플레이 시간 (시간)" value={draft.hours} step={0.5} onChange={(hours) => set({ hours })} />
        <NumberField label="바이인 합계 (원)" value={draft.buyIn} step={1000} onChange={(buyIn) => set({ buyIn })} />
        <NumberField label="캐시아웃 (원)" value={draft.cashOut} step={1000} onChange={(cashOut) => set({ cashOut })} />
        <label className="text-xs text-slate-500 sm:col-span-2">
          메모
          <input value={draft.notes} onChange={(e) => set({ notes: e.target.value })} className={inputClass} />
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onSave} className="rounded-md bg-felt-600 px-4 py-2 text-sm font-semibold text-white hover:bg-felt-700">
          저장
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-200 px-4 py-2 text-sm dark:border-slate-700">
          취소
        </button>
      </div>
    </Panel>
  )
}
