import { callEV, potOddsRatio, requiredEquity } from '../../core/odds'
import Panel from '../../components/Panel'
import { bb, pct } from '../../components/format'
import { useEquityStore } from './store'

interface PotOddsPanelProps {
  /** 내 에퀴티. 아직 계산 전이면 null */
  equity: number | null
}

const inputClass =
  'w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right tabular-nums dark:border-slate-700 dark:bg-slate-800'

export default function PotOddsPanel({ equity }: PotOddsPanelProps) {
  const { pot, call, setPot, setCall } = useEquityStore()

  const required = requiredEquity(pot, call)
  const ev = equity === null ? null : callEV(equity, pot, call)

  return (
    <Panel title="팟 오즈">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-slate-500">
          팟 (상대 베팅 포함, BB)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            value={pot || ''}
            placeholder="0"
            onChange={(e) => setPot(Number(e.target.value))}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="text-xs text-slate-500">
          내가 콜할 금액 (BB)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            value={call || ''}
            placeholder="0"
            onChange={(e) => setCall(Number(e.target.value))}
            className={`mt-1 ${inputClass}`}
          />
        </label>
      </div>

      {call > 0 && (
        <div className="mt-3 space-y-1 text-sm">
          <p>
            팟 오즈 <strong>{potOddsRatio(pot, call).toFixed(1)} : 1</strong> → 필요 승률{' '}
            <strong>{pct(required)}</strong>
          </p>
          {equity !== null && ev !== null && (
            <p className={ev >= 0 ? 'text-felt-600 dark:text-felt-100' : 'text-red-600 dark:text-red-400'}>
              내 승률 {pct(equity)} → 콜 {ev >= 0 ? '이득' : '손해'} (기대값 {bb(ev)})
            </p>
          )}
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-400">
        이번 콜만 계산합니다. 이후 스트리트의 추가 베팅(임플라이드 오즈)은 고려하지 않아요.
      </p>
    </Panel>
  )
}
