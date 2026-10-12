import NumberField from '../../components/NumberField'
import Panel from '../../components/Panel'
import Segmented from '../../components/Segmented'
import { POSITIONS, preflopAdvice, type PreflopSpot } from '../../core/preflopSizing'
import { useSizingStore, type PreflopKind } from './store'

const KIND_OPTIONS: { value: PreflopKind; label: string }[] = [
  { value: 'open', label: '오픈 (첫 레이즈)' },
  { value: '3bet', label: '3벳' },
  { value: '4bet', label: '4벳' },
]

export default function PreflopPanel() {
  const s = useSizingStore()

  const spot: PreflopSpot =
    s.preflopKind === 'open'
      ? { kind: 'open', position: s.position, limpers: s.limpers, style: s.gameStyle, stack: s.preflopStack }
      : s.preflopKind === '3bet'
        ? { kind: '3bet', openSize: s.openSize, inPosition: s.inPosition, callers: s.callers, stack: s.preflopStack }
        : { kind: '4bet', threeBetSize: s.threeBetSize, inPosition: s.inPosition, stack: s.preflopStack }

  let advice = null
  let error: string | null = null
  try {
    advice = preflopAdvice(spot)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  const positionToggle = (
    <div>
      <p className="mb-1 text-xs text-slate-500">플랍 이후 포지션</p>
      <Segmented
        label="플랍 이후 포지션"
        value={s.inPosition ? 'ip' : 'oop'}
        options={[
          { value: 'ip', label: '있음 (내가 나중에 행동)' },
          { value: 'oop', label: '없음' },
        ]}
        onChange={(v) => s.set({ inPosition: v === 'ip' })}
      />
    </div>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel title="상황 입력">
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs text-slate-500">상황</p>
            <Segmented
              label="상황"
              value={s.preflopKind}
              options={KIND_OPTIONS}
              onChange={(preflopKind) => s.set({ preflopKind })}
            />
          </div>

          {s.preflopKind === 'open' && (
            <>
              <label className="block text-xs text-slate-500">
                내 포지션
                <select
                  value={s.position}
                  onChange={(e) => s.set({ position: e.target.value as (typeof POSITIONS)[number] })}
                  className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {POSITIONS.filter((p) => p !== 'BB').map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className="mb-1 text-xs text-slate-500">게임</p>
                <Segmented
                  label="게임"
                  value={s.gameStyle}
                  options={[
                    { value: 'online', label: '온라인' },
                    { value: 'live', label: '라이브' },
                  ]}
                  onChange={(gameStyle) => s.set({ gameStyle })}
                />
              </div>
              <NumberField label="앞에서 림프(콜)한 사람 수" value={s.limpers} step={1} onChange={(limpers) => s.set({ limpers: Math.round(limpers) })} />
            </>
          )}

          {s.preflopKind === '3bet' && (
            <>
              <NumberField label="상대 오픈 금액 (BB)" value={s.openSize} onChange={(openSize) => s.set({ openSize })} />
              <NumberField label="오픈에 콜한 사람 수" value={s.callers} step={1} onChange={(callers) => s.set({ callers: Math.round(callers) })} />
              {positionToggle}
            </>
          )}

          {s.preflopKind === '4bet' && (
            <>
              <NumberField label="상대 3벳 금액 (BB)" value={s.threeBetSize} onChange={(threeBetSize) => s.set({ threeBetSize })} />
              {positionToggle}
            </>
          )}

          <NumberField label="유효 스택 (BB)" value={s.preflopStack} step={1} onChange={(preflopStack) => s.set({ preflopStack })} />
        </div>
      </Panel>

      <Panel title="추천">
        {error || !advice ? (
          <p className="py-6 text-center text-sm text-red-600">{error}</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-felt-50 px-4 py-3 dark:bg-felt-900/40">
              <p className="text-xs text-slate-500">추천 (총 레이즈 금액)</p>
              <p className="text-2xl font-bold text-felt-700 dark:text-felt-100">
                {advice.allIn ? `올인 ${advice.amount} BB` : `레이즈 ${advice.amount} BB`}
              </p>
            </div>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {advice.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <p className="rounded-md bg-slate-50 p-2 text-[11px] text-slate-500 dark:bg-slate-800/60">
              널리 쓰이는 표준 사이즈 경험칙입니다. 이 핸드로 레이즈할지 말지는 레인지 탭의 차트를 참고하세요.
            </p>
          </div>
        )}
      </Panel>
    </div>
  )
}
