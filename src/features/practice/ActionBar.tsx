import { useState } from 'react'
import { chips, currentBet, legalActions, totalPot, type HandState } from '../../core/game'
import { HERO, usePracticeStore } from './store'

const button =
  'rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40'

export default function ActionBar({ hand }: { hand: HandState }) {
  const heroAct = usePracticeStore((s) => s.heroAct)
  const legal = legalActions(hand)
  const myTurn = hand.toAct === HERO
  const bet = currentBet(hand)
  const pot = totalPot(hand)

  // 레이즈 프리셋: 콜한 뒤의 팟을 기준으로 한 비율 (베팅이 없으면 현재 팟 기준)
  const presetTo = (f: number) => {
    const raw = bet === 0 ? pot * f : bet + f * (pot + legal.callAmount)
    return chips(Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, Math.round(raw * 2) / 2)))
  }
  const presets = [
    { label: '최소', to: legal.minRaiseTo },
    { label: '½ 팟', to: presetTo(0.5) },
    { label: '¾ 팟', to: presetTo(0.75) },
    { label: '팟', to: presetTo(1) },
    { label: '올인', to: legal.maxRaiseTo },
  ]

  const [amount, setAmount] = useState<number | null>(null)
  const raiseAmount = amount === null ? presetTo(0.66) : amount
  const valid = raiseAmount >= legal.minRaiseTo && raiseAmount <= legal.maxRaiseTo
  const [error, setError] = useState<string | null>(null)

  const act = (fn: () => void) => {
    try {
      fn()
      setAmount(null)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (!myTurn) return null

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          className={`${button} bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100`}
          disabled={!legal.canFold}
          onClick={() => act(() => heroAct({ type: 'fold' }))}
        >
          폴드
        </button>
        {legal.canCheck ? (
          <button
            type="button"
            className={`${button} bg-sky-600 text-white hover:bg-sky-700`}
            onClick={() => act(() => heroAct({ type: 'check' }))}
          >
            체크
          </button>
        ) : (
          <button
            type="button"
            className={`${button} bg-sky-600 text-white hover:bg-sky-700`}
            onClick={() => act(() => heroAct({ type: 'call' }))}
          >
            콜 {legal.callAmount} BB
          </button>
        )}
        <button
          type="button"
          className={`${button} bg-rose-600 text-white hover:bg-rose-700`}
          disabled={!legal.canRaise || !valid}
          onClick={() => act(() => heroAct({ type: 'raise', to: raiseAmount }))}
        >
          {raiseAmount === legal.maxRaiseTo ? '올인' : bet === 0 ? '베팅' : '레이즈'} {raiseAmount} BB
        </button>
      </div>

      {legal.canRaise && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setAmount(p.to)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  raiseAmount === p.to
                    ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={legal.minRaiseTo}
              max={legal.maxRaiseTo}
              step={0.5}
              value={raiseAmount}
              onChange={(e) => setAmount(Number(e.target.value))}
              aria-label="레이즈 금액"
              className="flex-1 accent-rose-600"
            />
            <input
              type="number"
              min={legal.minRaiseTo}
              max={legal.maxRaiseTo}
              step={0.5}
              value={raiseAmount}
              onChange={(e) => setAmount(Number(e.target.value))}
              aria-label="레이즈 금액 직접 입력"
              className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
            />
            <span className="text-xs text-slate-500">BB</span>
          </div>
          {!valid && (
            <p className="text-xs text-red-600">
              {legal.minRaiseTo} ~ {legal.maxRaiseTo} BB 사이로 정해 주세요.
            </p>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
