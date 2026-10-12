// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type { StoredHand, StoredSession } from '../core/history'
import { addHand, addSession, db, deleteHandsBySource, deleteSession, updateHand } from './index'

const hand = (patch: Partial<StoredHand> = {}): StoredHand => ({
  createdAt: new Date().toISOString(),
  source: 'manual',
  sessionId: null,
  heroPosition: 'BTN',
  villainPosition: 'BB',
  effectiveStack: 100,
  heroCards: [51, 50],
  villainCards: null,
  board: [],
  actions: [],
  heroNet: 1.5,
  notes: '',
  ...patch,
})

const session: StoredSession = {
  date: '2026-10-12',
  kind: 'live',
  venue: '홈게임',
  stakes: '1000/2000',
  bbValue: 2000,
  buyIn: 200000,
  cashOut: 260000,
  hours: 3,
  notes: '',
}

afterEach(async () => {
  await db.hands.clear()
  await db.sessions.clear()
})

describe('핸드 기록 DB', () => {
  it('핸드를 저장하고 수정한다', async () => {
    const id = await addHand(hand())
    await updateHand(id, { notes: '복기 메모' })
    expect((await db.hands.get(id))?.notes).toBe('복기 메모')
  })

  it('출처별로 지운다', async () => {
    await addHand(hand({ source: 'practice' }))
    await addHand(hand({ source: 'practice' }))
    await addHand(hand({ source: 'manual' }))
    expect(await deleteHandsBySource('practice')).toBe(2)
    expect(await db.hands.count()).toBe(1)
  })

  it('세션을 지우면 연결된 핸드는 남고 연결만 끊긴다', async () => {
    const sid = await addSession(session)
    const hid = await addHand(hand({ sessionId: sid }))
    await deleteSession(sid)
    expect(await db.sessions.count()).toBe(0)
    expect((await db.hands.get(hid))?.sessionId).toBeNull()
  })
})
