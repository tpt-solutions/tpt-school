import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { queryDate } from '@/lib/form'
import { buildUniversalAttendanceRow, buildCsvString, UNIVERSAL_ATTENDANCE_HEADERS, ExportAttendance } from '@/lib/sis-export'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const fromRaw = req.nextUrl.searchParams.get('from')
  const toRaw = req.nextUrl.searchParams.get('to')
  // Invalid dates are rejected with 400 rather than reaching the query
  const from = fromRaw ? queryDate(fromRaw) : undefined
  const to = toRaw ? queryDate(toRaw) : undefined
  if ((fromRaw && !from) || (toRaw && !to)) {
    return new NextResponse('from and to must be valid dates (YYYY-MM-DD)', { status: 400 })
  }
  // The end date is inclusive: include the whole of that day
  if (to) to.setHours(23, 59, 59, 999)

  const records = await db.attendance.findMany({
    where: {
      ...(from || to ? {
        date: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
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
