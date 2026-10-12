import Panel from '../../components/Panel'
import type { Verdict } from '../../core/coach'
import type { Street } from '../../core/game'
import type { FeedbackEntry } from './store'

const STREET_LABELS: Record<Street, string> = { preflop: '프리플랍', flop: '플랍', turn: '턴', river: '리버' }

const VERDICT: Record<Verdict, { label: string; className: string }> = {
  good: { label: '좋음', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' },
  ok: { label: '괜찮음', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' },
  mistake: { label: '실수', className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' },
}

export default function FeedbackPanel({ entries }: { entries: FeedbackEntry[] }) {
  const done = entries.filter((e) => e.status === 'done' && e.feedback)
  const totalLoss = done.reduce((sum, e) => sum + (e.feedback!.evLoss ?? 0), 0)
  const mistakes = done.filter((e) => e.feedback!.verdict === 'mistake').length

  return (
    <Panel title="코치 피드백">
      {entries.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">내가 행동할 때마다 여기에 피드백이 쌓여요.</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-500">
            결정 {done.length}번 · 실수 {mistakes}번 · 추정 기대값 손실 합계 {totalLoss.toFixed(1)} BB
          </p>
          <ul className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
            {entries.map((e) => (
              <li key={e.id} className="rounded-lg border border-slate-100 p-2.5 text-sm dark:border-slate-800">
                <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                  <span>#{e.handNo}</span>
                  <span>{STREET_LABELS[e.street]}</span>
                  {e.feedback && (
                    <span className={`ml-auto rounded-full px-2 py-0.5 font-semibold ${VERDICT[e.feedback.verdict].className}`}>
                      {VERDICT[e.feedback.verdict].label}
                    </span>
                  )}
                </div>
                {e.status === 'pending' && <p className="text-xs text-slate-400">분석 중…</p>}
                {e.status === 'error' && <p className="text-xs text-red-600">{e.error}</p>}
                {e.feedback && (
                  <>
                    <p>
                      내 선택 <strong>{e.feedback.chosen}</strong> · 추천 <strong>{e.feedback.recommended}</strong>
                      {e.feedback.evLoss !== null && e.feedback.evLoss > 0.05 && (
                        <span className="text-rose-600 dark:text-rose-400"> (−{e.feedback.evLoss.toFixed(2)} BB)</span>
                      )}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                      {e.feedback.notes.map((n, i) => (
                        <li key={i}>· {n}</li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}
