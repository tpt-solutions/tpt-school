import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'teacher')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { classId } = await params

  const cls = await db.class.findUnique({
    where: { id: classId },
    include: {
      teachers: { include: { staff: { include: { user: { select: { id: true } } } } } },
      enrolments: {
        where: { status: 'active' },
        include: { student: { include: { user: { select: { name: true } } } } },
        orderBy: { student: { user: { name: 'asc' } } },
      },
      gradebooks: {
        include: {
          term: { select: { name: true } },
          grades: true,
        },
        orderBy: { dueDate: 'asc' },
      },
    },
  })

  if (!cls) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.role === 'teacher') {
    const isTeacher = cls.teachers.some((t) => t.staff.user.id === session.id)
    if (!isTeacher) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const wb = XLSX.utils.book_new()

  // Sheet 1: Summary — rows = students, columns = assessments
  const headerRow: Record<string, string | number> = {
    'Student Name': '',
    'Student ID': '',
  }
  for (const gb of cls.gradebooks) {
    headerRow[`${gb.name} (${gb.term.name})`] = ''
    headerRow[`${gb.name} %`] = ''
  }

  const summaryRows = cls.enrolments.map((e) => {
    const row: Record<string, string | number> = {
      'Student Name': e.student.user.name,
      'Student ID': e.student.studentId,
    }
    for (const gb of cls.gradebooks) {
      const grade = gb.grades.find((g) => g.studentId === e.student.id)
      row[`${gb.name} (${gb.term.name})`] = grade?.score ?? ''
      row[`${gb.name} %`] = grade?.score != null
        ? `${Math.round((grade.score / gb.maxScore) * 100)}%`
        : ''
    }
    return row
  })

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
  wsSummary['!cols'] = [{ wch: 25 }, { wch: 12 }, ...cls.gradebooks.flatMap(() => [{ wch: 16 }, { wch: 8 }])]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  // Sheet per gradebook
  for (const gb of cls.gradebooks) {
    const gradeMap = new Map(gb.grades.map((g) => [g.studentId, g]))
    const rows = cls.enrolments.map((e) => {
      const g = gradeMap.get(e.student.id)
      return {
        'Student Name': e.student.user.name,
        'Student ID': e.student.studentId,
        'Score': g?.score ?? '',
        'Max Score': gb.maxScore,
        'Percentage': g?.score != null ? `${Math.round((g.score / gb.maxScore) * 100)}%` : '',
        'Grade': g?.grade ?? '',
        'Comment': g?.comment ?? '',
        'Submitted': g?.submittedAt ? new Date(g.submittedAt).toLocaleDateString('en-NZ') : '',
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 30 }, { wch: 14 }]
    const sheetName = gb.name.slice(0, 31).replace(/[:\\/?\[\]*]/g, '') // Excel 31 char sheet name limit
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const safeName = cls.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName}_Grades_Report.xlsx"`,
    },
  })
}
