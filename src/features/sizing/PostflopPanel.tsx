import { useMemo } from 'react'
import CardPicker from '../../components/CardPicker'
import NumberField from '../../components/NumberField'
import Panel from '../../components/Panel'
import PlayingCard from '../../components/PlayingCard'
import Segmented from '../../components/Segmented'
import { pct } from '../../components/format'
import type { Card } from '../../core/cards'
import type { Combo } from '../../core/equity'
import { rangeCombos } from '../../core/range'
import {
  VILLAIN_STYLE_LABELS,
  type PostflopAdvice,
  type PostflopInput,
  type SizeOption,
  type VillainStyle,
} from '../../core/sizing'
import { useWorkerTask } from '../../hooks/useWorkerTask'
import { playableClasses } from '../ranges/model'
import { useRangesStore } from '../ranges/store'
import { explainPostflop } from './explain'
import { useSizingStore } from './store'

const createSizingWorker = () =>
  new Worker(new URL('../../workers/sizing.worker.ts', import.meta.url), { type: 'module' })

const STYLE_OPTIONS = (Object.keys(VILLAIN_STYLE_LABELS) as VillainStyle[]).map((value) => ({
  value,
  label: VILLAIN_STYLE_LABELS[value],
}))

const smallButton =
  'rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

function optionLabel(o: SizeOption): string {
  if (o.kind === 'check') return '체크'
  if (o.kind === 'allin') return '올인'
  return `팟의 ${Math.round(o.fraction * 100)}%`
}

export default function PostflopPanel() {
  const s = useSizingStore()
  const charts = useRangesStore((r) => r.charts)

  const { input, message } = useMemo((): { input: Omit<PostflopInput, 'random'> | null; message: string | null } => {
    const hero = s.cards.slice(0, 2)
    const board = s.cards.slice(2).filter((c): c is Card => c !== null)
    if (hero[0] === null || hero[1] === null) return { input: null, message: '내 핸드 2장을 골라 주세요.' }
    if (board.length < 3) return { input: null, message: '보드(플랍 3장 이상)를 골라 주세요.' }
    if (!(s.pot > 0) || !(s.stack > 0)) return { input: null, message: '팟과 유효 스택을 입력해 주세요.' }
    let villain: Combo[] | null = null
    if (s.villainRangeId !== null) {
      const chart = charts.find((c) => c.id === s.villainRangeId)
      if (!chart) return { input: null, message: '상대 레인지를 다시 골라 주세요.' }
      villain = rangeCombos(playableClasses(chart))
      if (villain.length === 0) return { input: null, message: `레인지 "${chart.name}"가 비어 있어요.` }
    }
    return {
      input: { hero: [hero[0], hero[1]], board, pot: s.pot, stack: s.stack, villain, style: s.villainStyle },
      message: null,
    }
  }, [s.cards, s.pot, s.stack, s.villainRangeId, s.villainStyle, charts])

  const task = useWorkerTask<Omit<PostflopInput, 'random'>, PostflopAdvice>(createSizingWorker, input)

  const slot = (i: number, label: string) => (
    <PlayingCard
      card={s.cards[i]}
      active={s.active === i}
      onClick={() => s.set({ active: i })}
      emptyLabel={label}
    />
  )
  const activeCard = s.active === null ? null : s.cards[s.active]
  const used = new Set(s.cards.filter((c): c is Card => c !== null))

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel
        title="상황 입력"
        actions={
          <button type="button" className={smallButton} onClick={s.resetCards}>
            카드 초기화
          </button>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">내 핸드</p>
              <div className="flex gap-1.5">
                {slot(0, '내 핸드 첫 번째 카드')}
                {slot(1, '내 핸드 두 번째 카드')}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">보드 (플랍·턴·리버)</p>
              <div className="flex gap-1.5">
                {[2, 3, 4, 5, 6].map((i) => (
                  <span key={i} className={i >= 5 ? 'ml-1.5' : ''}>
                    {slot(i, `보드 ${i - 1}번째 카드`)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {s.active !== null ? '선택한 칸에 넣을 카드를 고르세요' : '위에서 카드를 넣을 칸을 먼저 고르세요'}
              </p>
              <button type="button" className={smallButton} onClick={s.clearActive} disabled={activeCard === null}>
                이 칸 지우기
              </button>
            </div>
            <CardPicker disabled={used} selected={activeCard} onPick={s.pick} />
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <NumberField label="현재 팟 (BB)" value={s.pot} onChange={(pot) => s.set({ pot })} />
            <NumberField label="유효 스택 (BB, 베팅 가능 최대)" value={s.stack} onChange={(stack) => s.set({ stack })} />
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-slate-500">
              상대 레인지
              <select
                value={s.villainRangeId ?? ''}
                onChange={(e) => s.set({ villainRangeId: e.target.value || null })}
                className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">랜덤 핸드 (모든 핸드)</option>
                {charts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="mb-1 text-xs text-slate-500">상대 성향</p>
              <Segmented
                label="상대 성향"
                value={s.villainStyle}
                options={STYLE_OPTIONS}
                onChange={(villainStyle) => s.set({ villainStyle })}
              />
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="추천">
        {message ? (
          <p className="py-6 text-center text-sm text-slate-500">{message}</p>
        ) : task.status === 'error' ? (
          <p className="py-6 text-center text-sm text-red-600">{task.error}</p>
        ) : !task.result ? (
          <p className="py-6 text-center text-sm text-slate-500">계산 중…</p>
        ) : (
          <AdviceView advice={task.result} pot={s.pot} running={task.status === 'running'} />
        )}
      </Panel>
    </div>
  )
}

function AdviceView({ advice, pot, running }: { advice: PostflopAdvice; pot: number; running: boolean }) {
  const b = advice.best
  const headline =
    b.kind === 'check'
      ? '체크'
      : b.kind === 'allin'
        ? `올인 ${b.bet} BB`
        : `베팅 ${b.bet} BB (팟의 ${Math.round(b.fraction * 100)}%)`

  return (
    <div className={`space-y-4 transition-opacity ${running ? 'opacity-60' : ''}`}>
      <div className="rounded-lg bg-felt-50 px-4 py-3 dark:bg-felt-900/40">
        <p className="text-xs text-slate-500">추천</p>
        <p className="text-2xl font-bold text-felt-700 dark:text-felt-100">{headline}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs tabular-nums">
          <thead className="text-slate-500">
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th className="py-1.5 text-left font-medium">선택</th>
              <th className="font-medium">금액</th>
              <th className="font-medium">상대 폴드</th>
              <th className="font-medium">콜당하면 승률</th>
              <th className="font-medium">기대값</th>
            </tr>
          </thead>
          <tbody>
            {advice.options.map((o) => (
              <tr
                key={`${o.kind}-${o.bet}`}
                className={`border-b border-slate-50 dark:border-slate-800/60 ${
                  o === b ? 'bg-felt-50 font-semibold dark:bg-felt-900/40' : ''
                }`}
              >
                <td className="py-1.5 text-left">{optionLabel(o)}</td>
                <td>{o.kind === 'check' ? '-' : `${o.bet} BB`}</td>
                <td>{o.kind === 'check' ? '-' : pct(o.foldRate, 0)}</td>
                <td>{pct(o.equityWhenCalled, 0)}</td>
                <td>{o.ev.toFixed(2)} BB</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[11px] text-slate-400">
          기대값 = 이 결정 이후 내가 가져갈 것으로 기대되는 칩 (현재 팟 {pot} BB 기준, 이번에 낸 베팅은 뺀 값)
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-500">근거</p>
        <ul className="list-disc space-y-1 pl-4 text-sm">
          {explainPostflop(advice).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      <p className="rounded-md bg-slate-50 p-2 text-[11px] text-slate-500 dark:bg-slate-800/60">
        단순화한 모델의 추정치입니다. 상대는 콜 또는 폴드만 하고(레이즈 없음), 강한 핸드부터 MDF(+성향 보정)만큼 방어한다고
        가정합니다. 체크는 쇼다운까지 간다고 보고, 이후 스트리트의 베팅은 계산하지 않습니다.
      </p>
    </div>
  )
}
