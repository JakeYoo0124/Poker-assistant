import Panel from '../../components/Panel'
import type { ActionRecord, HandState, Street } from '../../core/game'
import { HERO } from './store'

const STREET_LABELS: Record<Street, string> = { preflop: '프리플랍', flop: '플랍', turn: '턴', river: '리버' }

function actionText(r: ActionRecord): string {
  const allIn = r.allIn ? ' (올인)' : ''
  switch (r.type) {
    case 'fold':
      return '폴드'
    case 'check':
      return '체크'
    case 'call':
      return `콜 ${r.amount} BB${allIn}`
    case 'bet':
      return `베팅 ${r.amount} BB${allIn}`
    case 'raise':
      return `레이즈 ${r.amount} BB${allIn}`
  }
}

export default function HandLog({ hand }: { hand: HandState }) {
  return (
    <Panel title="이번 핸드 진행">
      <ol className="space-y-0.5 text-sm">
        <li className="text-xs text-slate-500">
          블라인드: {hand.button === HERO ? '나 SB 0.5 / AI BB 1' : 'AI SB 0.5 / 나 BB 1'}
        </li>
        {hand.log.map((r, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-14 shrink-0 text-xs leading-5 text-slate-400">{STREET_LABELS[r.street]}</span>
            <span className={r.player === HERO ? 'font-medium' : 'text-slate-600 dark:text-slate-300'}>
              {r.player === HERO ? '나' : 'AI'}: {actionText(r)}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
