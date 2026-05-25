import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildNzMoeRow, buildCsvString, NZ_MOE_HEADERS, ExportStudent } from '@/lib/sis-export'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const students = await db.student.findMany({
    include: { user: true },
    orderBy: { user: { name: 'asc' } },
  })

  const rows: ExportStudent[] = students.map(s => {
    const [firstName, ...rest] = (s.user.name ?? '').split(' ')
    return {
      id: s.id,
      studentId: s.studentId,
      nsn: s.nsn,
      name: s.user.name ?? '',
      firstName,
      lastName: rest.join(' '),
      dateOfBirth: s.dateOfBirth,
      gender: s.gender,
      yearLevel: s.yearLevel,
      enrollmentStatus: s.enrollmentStatus,
      enrollmentDate: s.enrollmentDate,
      ethnicity: s.ethnicity,
      indigenousStatus: s.indigenousStatus,
      languageBackground: s.languageBackground,
      nationality: s.nationality,
      address: s.address,
    }
  })

  const csv = buildCsvString(rows.map(buildNzMoeRow), NZ_MOE_HEADERS)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="nz-moe-students.csv"',
    },
  })
}
