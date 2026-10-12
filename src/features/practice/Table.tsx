import PlayingCard from '../../components/PlayingCard'
import { describeScore } from '../../core/evaluator'
import { totalPot, type HandState, type PlayerId } from '../../core/game'
import { BOT, HERO } from './store'

function CardBack() {
  return (
    <span
      aria-label="뒤집힌 카드"
      role="img"
      className="inline-flex h-14 w-10 shrink-0 rounded-md border border-felt-900 bg-[repeating-linear-gradient(45deg,var(--color-felt-700)_0_4px,var(--color-felt-800)_4px_8px)]"
    />
  )
}

interface SeatProps {
  hand: HandState
  player: PlayerId
  name: string
  reveal: boolean
  thinking?: boolean
}

function Seat({ hand, player, name, reveal, thinking }: SeatProps) {
  const isButton = hand.button === player
  const bet = hand.committed[player]
  const scores = hand.result?.scores
  const won = hand.result?.winners.includes(player)
  return (
    <div className={`flex items-center gap-3 ${player === BOT ? 'flex-row' : 'flex-row'}`}>
      <div className="flex gap-1">
        {hand.holes[player].map((c) => (reveal ? <PlayingCard key={c} card={c} /> : <CardBack key={c} />))}
      </div>
      <div className="min-w-0 text-sm">
        <p className="flex items-center gap-1.5 font-semibold text-white">
          {name}
          {isButton && (
            <span className="rounded-full bg-white px-1.5 text-[10px] font-bold text-slate-900" title="버튼 (스몰 블라인드)">
              D
            </span>
          )}
          {hand.toAct === player && !hand.result && (
            <span className="text-xs font-normal text-amber-300">{thinking ? '생각 중…' : '차례'}</span>
          )}
        </p>
        <p className="text-felt-100 tabular-nums">스택 {hand.stacks[player]} BB</p>
        {bet > 0 && <p className="text-xs text-amber-200 tabular-nums">베팅 {bet} BB</p>}
        {scores && reveal && (
          <p className={`text-xs ${won ? 'font-semibold text-amber-300' : 'text-felt-100/80'}`}>
            {describeScore(scores[player]).name}
            {won ? ' · 승리' : ''}
          </p>
        )}
      </div>
    </div>
  )
}

interface TableProps {
  hand: HandState
  botName: string
  botThinking: boolean
}

export default function Table({ hand, botName, botThinking }: TableProps) {
  // 쇼다운이면 AI 카드를 공개한다
  const revealBot = hand.result?.showdown === true
  const board = [...hand.board, ...Array(5 - hand.board.length).fill(null)]

  return (
    <div className="space-y-4 rounded-2xl border-4 border-felt-900 bg-felt-700 p-4 shadow-inner">
      <Seat hand={hand} player={BOT} name={`AI · ${botName}`} reveal={revealBot} thinking={botThinking} />

      <div className="flex flex-col items-center gap-2 py-2">
        <div className="flex gap-1">
          {board.map((c, i) =>
            c === null ? (
              <span key={i} className="h-14 w-10 rounded-md border border-dashed border-felt-500/60" />
            ) : (
              <PlayingCard key={c} card={c} />
            ),
          )}
        </div>
        <p className="rounded-full bg-felt-900/60 px-3 py-0.5 text-sm font-semibold text-white tabular-nums">
          팟 {totalPot(hand)} BB
        </p>
      </div>

      <Seat hand={hand} player={HERO} name="나" reveal />
    </div>
  )
}
