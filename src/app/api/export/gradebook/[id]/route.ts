import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'teacher')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const gradebook = await db.gradebook.findUnique({
    where: { id },
    include: {
      class: {
        include: {
          enrolments: {
            where: { status: 'active' },
            include: { student: { include: { user: { select: { name: true } } } } },
            orderBy: { student: { user: { name: 'asc' } } },
          },
          teachers: { include: { staff: { include: { user: { select: { id: true } } } } } },
        },
      },
      term: { include: { academicYear: true } },
      grades: true,
    },
  })

  if (!gradebook) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Teachers may only export their own class
  if (session.role === 'teacher') {
    const staff = await db.staff.findUnique({ where: { userId: session.id } })
    const isTeacher = gradebook.class.teachers.some((t) => t.staff.user.id === session.id)
    if (!staff || !isTeacher) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const gradeMap = new Map(gradebook.grades.map((g) => [g.studentId, g]))

  const rows = gradebook.class.enrolments.map((e) => {
    const g = gradeMap.get(e.student.id)
    return {
      'Student Name': e.student.user.name,
      'Student ID': e.student.studentId,
      'Score': g?.score ?? '',
      'Max Score': gradebook.maxScore,
      'Percentage': g?.score != null ? `${Math.round((g.score / gradebook.maxScore) * 100)}%` : '',
      'Grade': g?.grade ?? '',
      'Comment': g?.comment ?? '',
      'Submitted At': g?.submittedAt ? new Date(g.submittedAt).toLocaleDateString('en-NZ') : '',
      'Submission URL': g?.submissionUrl ?? '',
      'Graded At': g?.gradedAt ? new Date(g.gradedAt).toLocaleDateString('en-NZ') : '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Grades')

  // Set column widths
  ws['!cols'] = [
    { wch: 25 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 12 },
    { wch: 8 }, { wch: 30 }, { wch: 14 }, { wch: 40 }, { wch: 14 },
  ]

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const safeName = `${gradebook.class.name}_${gradebook.name}`.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName}.xlsx"`,
    },
  })
}
