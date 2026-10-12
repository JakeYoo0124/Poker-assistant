import Dexie, { type EntityTable } from 'dexie'
import type { StoredHand, StoredSession } from '../core/history'

/** 브라우저 IndexedDB에 저장하는 핸드 기록·세션 */
export class PokerDB extends Dexie {
  hands!: EntityTable<StoredHand, 'id'>
  sessions!: EntityTable<StoredSession, 'id'>

  constructor(name = 'poker-assistant') {
    super(name)
    this.version(1).stores({
      // 첫 항목은 기본 키, 나머지는 검색·정렬용 인덱스
      hands: '++id, createdAt, source, sessionId',
      sessions: '++id, date',
    })
  }
}

export const db = new PokerDB()

export function addHand(hand: StoredHand): Promise<number> {
  return db.hands.add(hand) as Promise<number>
}

export function updateHand(id: number, patch: Partial<StoredHand>): Promise<number> {
  return db.hands.update(id, patch)
}

export function deleteHand(id: number): Promise<void> {
  return db.hands.delete(id)
}

export function deleteHandsBySource(source: StoredHand['source']): Promise<number> {
  return db.hands.where('source').equals(source).delete()
}

export function addSession(session: StoredSession): Promise<number> {
  return db.sessions.add(session) as Promise<number>
}

export function updateSession(id: number, patch: Partial<StoredSession>): Promise<number> {
  return db.sessions.update(id, patch)
}

/** 세션을 지우고, 그 세션에 연결된 핸드는 연결만 끊는다 */
export async function deleteSession(id: number): Promise<void> {
  await db.transaction('rw', db.sessions, db.hands, async () => {
    await db.hands.where('sessionId').equals(id).modify({ sessionId: null })
    await db.sessions.delete(id)
  })
}
