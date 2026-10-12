import { useMemo } from 'react'
import PageHeader from '../../components/PageHeader'
import { buildRequest } from './buildRequest'
import InputPanel from './InputPanel'
import OutsPanel from './OutsPanel'
import PotOddsPanel from './PotOddsPanel'
import ResultPanel from './ResultPanel'
import { useEquityStore } from './store'
import { useEquityWorker } from './useEquityWorker'

export default function EquityPage() {
  const hero = useEquityStore((s) => s.hero)
  const board = useEquityStore((s) => s.board)
  const opponents = useEquityStore((s) => s.opponents)

  const built = useMemo(() => buildRequest(hero, board, opponents), [hero, board, opponents])
  const worker = useEquityWorker(built.request)
  const heroEquity = built.request && worker.result ? (worker.result.players[0]?.equity ?? null) : null

  const showOuts =
    built.request !== null && built.hero && built.knownOpponents && (built.board.length === 3 || built.board.length === 4)

  return (
    <>
      <PageHeader title="승률 계산" description="내 핸드와 보드, 상대 레인지로 승률과 팟 오즈를 계산합니다." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <InputPanel />
        <div className="space-y-4">
          <ResultPanel
            worker={worker}
            message={built.message}
            hero={built.hero}
            board={built.board}
            opponents={opponents}
          />
          {showOuts && <OutsPanel hero={built.hero!} opponents={built.knownOpponents!} board={built.board} />}
          <PotOddsPanel equity={heroEquity} />
        </div>
      </div>
    </>
  )
}
