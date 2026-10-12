import NumberField from '../../components/NumberField'
import PageHeader from '../../components/PageHeader'
import Panel from '../../components/Panel'
import { BOT_PROFILES, type BotProfileId } from '../../core/bot'
import { netResult } from '../../core/game'
import ActionBar from './ActionBar'
import FeedbackPanel from './FeedbackPanel'
import HandLog from './HandLog'
import Table from './Table'
import { HERO, usePracticeStore } from './store'

const primary = 'rounded-lg bg-felt-600 px-4 py-2 text-sm font-semibold text-white hover:bg-felt-700'

export default function PracticePage() {
  const s = usePracticeStore()
  const profile = BOT_PROFILES[s.profileId]
  const hand = s.hand

  return (
    <>
      <PageHeader
        title="연습 게임"
        description="AI와 헤즈업으로 플레이하며, 내 결정마다 코치 피드백을 받습니다."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
        <label className="block text-xs text-slate-500">
          AI 성향
          <select
            value={s.profileId}
            onChange={(e) => s.setProfile(e.target.value as BotProfileId)}
            className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {Object.values(BOT_PROFILES).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <NumberField label="시작 스택 (BB)" value={s.startingStack} step={10} onChange={s.setStartingStack} />
        <button type="button" className={primary} onClick={s.newSession}>
          {hand ? '새 세션 시작' : '게임 시작'}
        </button>
      </div>
      <p className="-mt-2 mb-4 text-xs text-slate-500">{profile.description} 성향 변경은 다음 핸드부터 적용돼요.</p>

      {!hand ? (
        <Panel title="시작하기">
          <ul className="list-disc space-y-1 pl-4 text-sm text-slate-600 dark:text-slate-300">
            <li>매 핸드 양쪽 모두 시작 스택으로 채워서 시작합니다 (블라인드 0.5 / 1 BB).</li>
            <li>버튼(D)은 핸드마다 번갈아 맡습니다. 헤즈업에서는 버튼이 스몰 블라인드예요.</li>
            <li>내가 행동할 때마다 코치가 추천 행동과 비교해 기대값 손실을 알려줍니다.</li>
            <li>AI는 규칙 기반이라 솔버만큼 강하지는 않아요. 성향을 바꿔 가며 상황별 대응을 연습해 보세요.</li>
          </ul>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                핸드 <strong className="tabular-nums">{s.handsPlayed}</strong>
              </span>
              <span>
                누적 손익{' '}
                <strong className={`tabular-nums ${s.heroNet >= 0 ? 'text-felt-600 dark:text-felt-100' : 'text-rose-600'}`}>
                  {s.heroNet > 0 ? '+' : ''}
                  {s.heroNet} BB
                </strong>
              </span>
              {s.handsPlayed > 0 && (
                <span className="text-slate-500">
                  100핸드당 {((s.heroNet / s.handsPlayed) * 100).toFixed(0)} BB
                </span>
              )}
            </div>

            <Table hand={hand} botName={profile.name} botThinking={s.botThinking} />

            {hand.result ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <ResultText net={netResult(hand)[HERO]} split={hand.result.winners.length === 2} />
                <button type="button" className={`${primary} ml-auto`} onClick={s.nextHand}>
                  다음 핸드
                </button>
              </div>
            ) : (
              <ActionBar key={`${s.handNo}-${hand.log.length}`} hand={hand} />
            )}

            <HandLog hand={hand} />
          </div>

          <FeedbackPanel entries={s.feedback} />
        </div>
      )}
    </>
  )
}

function ResultText({ net, split }: { net: number; split: boolean }) {
  if (split) return <p className="font-semibold">스플릿 (팟을 나눠 가짐)</p>
  return (
    <p className={`font-semibold ${net > 0 ? 'text-felt-600 dark:text-felt-100' : 'text-rose-600'}`}>
      {net > 0 ? `승리! +${net} BB` : `패배 ${net} BB`}
    </p>
  )
}
