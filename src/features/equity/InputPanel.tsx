import CardPicker from '../../components/CardPicker'
import Panel from '../../components/Panel'
import PlayingCard from '../../components/PlayingCard'
import { MAX_OPPONENTS, getSlot, sameSlot, useEquityStore, usedCards, type SlotRef } from './store'

const STREET_LABELS = ['플랍', '', '', '턴', '리버']

const smallButton =
  'rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

export default function InputPanel() {
  const state = useEquityStore()
  const { board, opponents, active } = state

  const slot = (ref: SlotRef, emptyLabel: string) => (
    <PlayingCard
      card={getSlot(state, ref)}
      active={sameSlot(active, ref)}
      onClick={() => state.setActive(ref)}
      emptyLabel={emptyLabel}
    />
  )

  const activeCard = active ? getSlot(state, active) : null

  return (
    <Panel
      title="핸드 입력"
      actions={
        <button type="button" className={smallButton} onClick={state.resetAll}>
          전체 초기화
        </button>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500">내 핸드</p>
          <div className="flex gap-1.5">
            {slot({ kind: 'hero', index: 0 }, '내 핸드 첫 번째 카드')}
            {slot({ kind: 'hero', index: 1 }, '내 핸드 두 번째 카드')}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">보드</p>
            <button type="button" className={smallButton} onClick={state.resetBoard}>
              보드 비우기
            </button>
          </div>
          <div className="flex gap-1.5">
            {board.map((_, i) => (
              <div key={i} className={`flex flex-col items-center gap-0.5 ${i === 3 ? 'ml-2' : ''} ${i === 4 ? 'ml-2' : ''}`}>
                {slot({ kind: 'board', index: i }, `보드 ${i + 1}번째 카드`)}
                <span className="h-3 text-[10px] text-slate-400">{STREET_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">상대 ({opponents.length}명)</p>
            <button
              type="button"
              className={smallButton}
              onClick={state.addOpponent}
              disabled={opponents.length >= MAX_OPPONENTS}
            >
              + 상대 추가
            </button>
          </div>
          <ul className="space-y-1.5">
            {opponents.map((o, i) => (
              <li key={o.id} className="flex min-h-14 items-center gap-2">
                <span className="w-12 shrink-0 text-sm text-slate-600 dark:text-slate-300">상대 {i + 1}</span>
                <div className="flex overflow-hidden rounded-md border border-slate-200 text-xs dark:border-slate-700">
                  {(['random', 'hand'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={o.mode === mode}
                      onClick={() => state.setOpponentMode(i, mode)}
                      className={`px-2 py-1 ${
                        o.mode === mode
                          ? 'bg-felt-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      {mode === 'random' ? '랜덤' : '핸드 지정'}
                    </button>
                  ))}
                </div>
                {o.mode === 'hand' && (
                  <div className="flex gap-1">
                    {slot({ kind: 'opp', opp: i, index: 0 }, `상대 ${i + 1} 첫 번째 카드`)}
                    {slot({ kind: 'opp', opp: i, index: 1 }, `상대 ${i + 1} 두 번째 카드`)}
                  </div>
                )}
                <button
                  type="button"
                  aria-label={`상대 ${i + 1} 삭제`}
                  className="ml-auto rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:invisible dark:hover:bg-slate-800"
                  onClick={() => state.removeOpponent(i)}
                  disabled={opponents.length <= 1}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {active ? '선택한 칸에 넣을 카드를 고르세요' : '위에서 카드를 넣을 칸을 먼저 고르세요'}
            </p>
            <button type="button" className={smallButton} onClick={state.clearActive} disabled={activeCard === null}>
              이 칸 지우기
            </button>
          </div>
          <CardPicker disabled={usedCards(state)} selected={activeCard} onPick={state.pick} />
        </div>
      </div>
    </Panel>
  )
}
