import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildEdFiExport, ExportStudent, ExportAttendance } from '@/lib/sis-export'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const [students, attendanceRecords, settings] = await Promise.all([
    db.student.findMany({
      include: { user: true },
      orderBy: { user: { name: 'asc' } },
    }),
    db.attendance.findMany({
      include: { student: { include: { user: true } } },
      orderBy: { date: 'asc' },
    }),
    db.schoolSettings.findFirst(),
  ])

  const exportStudents: ExportStudent[] = students.map(s => {
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

  const exportAttendance: ExportAttendance[] = attendanceRecords.map(r => ({
    studentId: r.student.studentId,
    studentNsn: r.student.nsn,
    studentName: r.student.user.name ?? '',
    date: r.date,
    status: r.status,
    notes: r.notes,
  }))

  const schoolId = settings?.shortName ?? settings?.name ?? 'school-1'
  const edfi = buildEdFiExport(exportStudents, exportAttendance, schoolId)

  return NextResponse.json(edfi, {
    headers: {
      'Content-Disposition': 'attachment; filename="edfi-export.json"',
    },
  })
}
