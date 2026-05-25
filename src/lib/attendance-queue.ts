import { openDB } from 'idb'

const DB_NAME = 'tpt-attendance'
const STORE_NAME = 'pending'
const DB_VERSION = 1

export type QueuedAttendance = {
  id: string
  studentId: string
  classId: string
  termId: string
  date: string // ISO string
  status: string
  notes?: string
  markedById: string
  queuedAt: number
}

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    },
  })
}

export async function enqueue(record: QueuedAttendance): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, record)
}

export async function getPending(): Promise<QueuedAttendance[]> {
  const db = await getDb()
  return db.getAll(STORE_NAME)
}

export async function dequeue(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, id)
}

export async function clearAll(): Promise<void> {
  const db = await getDb()
  await db.clear(STORE_NAME)
}
