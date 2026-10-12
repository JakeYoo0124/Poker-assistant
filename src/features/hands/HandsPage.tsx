import { useState } from 'react'
import PageHeader from '../../components/PageHeader'
import Segmented from '../../components/Segmented'
import HandList from './HandList'
import SessionList from './SessionList'

type Tab = 'hands' | 'sessions'

export default function HandsPage() {
  const [tab, setTab] = useState<Tab>('hands')
  return (
    <>
      <PageHeader title="핸드 기록" description="플레이한 핸드와 세션을 기록하고 복기합니다." />
      <div className="mb-4">
        <Segmented
          label="보기"
          value={tab}
          options={[
            { value: 'hands', label: '핸드' },
            { value: 'sessions', label: '세션' },
          ]}
          onChange={setTab}
        />
      </div>
      {tab === 'hands' ? <HandList /> : <SessionList />}
    </>
  )
}
