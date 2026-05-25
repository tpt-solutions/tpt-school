import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildUniversalAttendanceRow, buildCsvString, UNIVERSAL_ATTENDANCE_HEADERS, ExportAttendance } from '@/lib/sis-export'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  const records = await db.attendance.findMany({
    where: {
      ...(from || to ? {
        date: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      } : {}),
    },
    include: { student: { include: { user: true } } },
    orderBy: [{ date: 'asc' }, { student: { user: { name: 'asc' } } }],
  })

  const rows: ExportAttendance[] = records.map(r => ({
    studentId: r.student.studentId,
    studentNsn: r.student.nsn,
    studentName: r.student.user.name ?? '',
    date: r.date,
    status: r.status,
    notes: r.notes,
  }))

  const csv = buildCsvString(rows.map(buildUniversalAttendanceRow), UNIVERSAL_ATTENDANCE_HEADERS)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="attendance.csv"',
    },
  })
}
