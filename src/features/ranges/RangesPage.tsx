import { useState } from 'react'
import PageHeader from '../../components/PageHeader'
import Panel from '../../components/Panel'
import { count, pct } from '../../components/format'
import { TOTAL_COMBOS, countCombos, formatRange } from '../../core/range'
import RangeGrid from './RangeGrid'
import {
  ACTION_CELL_CLASSES,
  ACTION_LABELS,
  RANGE_ACTIONS,
  classesWith,
  playableClasses,
  type RangeAction,
  type RangeChart,
} from './model'
import { useRangesStore } from './store'

const button =
  'rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

export default function RangesPage() {
  const { charts, selectedId, select, create, duplicate, remove, restoreDefaults } = useRangesStore()
  const chart = charts.find((c) => c.id === selectedId) ?? null

  return (
    <>
      <PageHeader
        title="프리플랍 레인지"
        description="포지션·상황별 스타팅 핸드 레인지를 13×13 그리드로 관리합니다."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={selectedId ?? ''}
          onChange={(e) => select(e.target.value)}
          aria-label="레인지 선택"
          className="min-w-40 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm sm:flex-none dark:border-slate-700 dark:bg-slate-800"
        >
          {charts.length === 0 && <option value="">레인지 없음</option>}
          {charts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="button" className={button} onClick={() => create('새 레인지')}>
          + 새 레인지
        </button>
        <button type="button" className={button} disabled={!chart} onClick={() => chart && duplicate(chart.id)}>
          복제
        </button>
        <button
          type="button"
          className={button}
          disabled={!chart}
          onClick={() => chart && confirm(`"${chart.name}" 레인지를 삭제할까요?`) && remove(chart.id)}
        >
          삭제
        </button>
        <button type="button" className={button} onClick={restoreDefaults}>
          기본 레인지 복원
        </button>
      </div>

      {chart ? (
        <RangeEditor key={chart.id} chart={chart} />
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">
          레인지가 없습니다. “새 레인지” 또는 “기본 레인지 복원”을 눌러 주세요.
        </p>
      )}
    </>
  )
}

function RangeEditor({ chart }: { chart: RangeChart }) {
  const { rename, paint, paintText, clear } = useRangesStore()
  const [brush, setBrush] = useState<RangeAction>('raise')
  const [text, setText] = useState('')
  const [textError, setTextError] = useState<string | null>(null)

  const total = countCombos(playableClasses(chart))

  const applyText = () => {
    try {
      paintText(chart.id, text, brush)
      setText('')
      setTextError(null)
    } catch (e) {
      setTextError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Panel title="차트">
        <input
          value={chart.name}
          onChange={(e) => rename(chart.id, e.target.value)}
          aria-label="레인지 이름"
          className="mb-3 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800"
        />

        <div className="mb-3 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="칠할 액션">
          {RANGE_ACTIONS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={brush === a}
              onClick={() => setBrush(a)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                brush === a
                  ? `${ACTION_CELL_CLASSES[a]} ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-slate-900`
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {ACTION_LABELS[a]}
            </button>
          ))}
          <button
            type="button"
            className={`${button} ml-auto`}
            onClick={() => confirm('이 차트의 모든 칸을 지울까요?') && clear(chart.id)}
          >
            전체 지우기
          </button>
        </div>

        <RangeGrid cells={chart.cells} brush={brush} onPaint={(classes, action) => paint(chart.id, classes, action)} />
        <p className="mt-2 text-[11px] text-slate-400">
          칸을 클릭하거나 드래그해서 칠하세요. 이미 같은 색인 칸에서 시작하면 지워집니다.
        </p>
      </Panel>

      <div className="space-y-4">
        <Panel title="통계">
          <p className="mb-3 text-sm">
            전체 <strong className="text-lg">{pct(total / TOTAL_COMBOS)}</strong>{' '}
            <span className="text-slate-500">({count(total)} / {count(TOTAL_COMBOS)} 콤보)</span>
          </p>
          <ul className="space-y-1.5 text-sm">
            {RANGE_ACTIONS.map((a) => {
              const n = countCombos(classesWith(chart, a))
              return (
                <li key={a} className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-sm ${ACTION_CELL_CLASSES[a]}`} />
                  <span className="w-12">{ACTION_LABELS[a]}</span>
                  <span className="tabular-nums">{pct(n / TOTAL_COMBOS)}</span>
                  <span className="text-xs text-slate-500 tabular-nums">({count(n)} 콤보)</span>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel title="텍스트 표기">
          <dl className="space-y-2 text-xs">
            {RANGE_ACTIONS.map((a) => {
              const classes = classesWith(chart, a)
              if (classes.length === 0) return null
              return (
                <div key={a}>
                  <dt className="font-semibold text-slate-500">{ACTION_LABELS[a]}</dt>
                  <dd className="mt-0.5 break-words font-mono text-slate-700 select-all dark:text-slate-300">
                    {formatRange(classes)}
                  </dd>
                </div>
              )
            })}
            {total === 0 && <p className="text-slate-400">아직 칠한 칸이 없어요.</p>}
          </dl>

          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <label className="text-xs text-slate-500" htmlFor="range-text">
              텍스트로 칠하기 ({ACTION_LABELS[brush]})
            </label>
            <div className="mt-1 flex gap-1.5">
              <input
                id="range-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyText()}
                placeholder="예: QQ+, ATs+, KQo"
                className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <button type="button" className={button} onClick={applyText} disabled={!text.trim()}>
                적용
              </button>
            </div>
            {textError && <p className="mt-1 text-xs text-red-600">{textError}</p>}
          </div>
        </Panel>
      </div>
    </div>
  )
}
