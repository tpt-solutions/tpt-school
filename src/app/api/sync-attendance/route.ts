import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkTruancyAction } from '@/app/(dashboard)/behaviour/actions'

type QueuedRecord = {
  id: string
  studentId: string
  classId: string
  termId: string
  date: string
  status: string
  notes?: string
  markedById: string
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['admin', 'teacher'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let records: QueuedRecord[]
  try {
    records = await req.json()
    if (!Array.isArray(records)) throw new Error('Expected array')
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const results = await Promise.allSettled(
    records.map(async (record) => {
      const date = new Date(record.date)
      date.setHours(0, 0, 0, 0)
      await db.attendance.upsert({
        where: { studentId_date: { studentId: record.studentId, date } },
        create: {
          studentId: record.studentId,
          termId: record.termId,
          date,
          status: record.status,
          notes: record.notes ?? null,
          markedById: session.id,
          markedAt: new Date(),
        },
        update: {
          status: record.status,
          notes: record.notes ?? null,
          markedById: session.id,
          markedAt: new Date(),
        },
      })
      return record.id
    }),
  )

  const saved = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<string>).value)
  const failed = results.filter(r => r.status === 'rejected').length

  // Fire truancy checks for absent students (fire-and-forget)
  const absentStudentIds = records
    .filter(r => r.status === 'absent')
    .map(r => r.studentId)
  if (absentStudentIds.length > 0) {
    const uniqueTermIds = [...new Set(records.map(r => r.termId))]
    Promise.all(
      absentStudentIds.flatMap(sid =>
        uniqueTermIds.map(tid => checkTruancyAction(sid, tid)),
      ),
    ).catch(() => {})
  }

  return NextResponse.json({ saved: saved.length, failed, savedIds: saved })
}
