import PageHeader from '../../components/PageHeader'
import Segmented from '../../components/Segmented'
import PostflopPanel from './PostflopPanel'
import PreflopPanel from './PreflopPanel'
import { useSizingStore } from './store'

export default function SizingPage() {
  const tab = useSizingStore((s) => s.tab)
  const set = useSizingStore((s) => s.set)

  return (
    <>
      <PageHeader title="베팅 사이즈 추천" description="후보 사이즈별 기대값을 비교해 몇 BB를 베팅할지 추천합니다." />
      <div className="mb-4">
        <Segmented
          label="스트리트"
          value={tab}
          options={[
            { value: 'postflop', label: '포스트플랍 (플랍·턴·리버)' },
            { value: 'preflop', label: '프리플랍' },
          ]}
          onChange={(t) => set({ tab: t })}
        />
      </div>
      {tab === 'postflop' ? <PostflopPanel /> : <PreflopPanel />}
    </>
  )
}
