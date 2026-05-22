import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'

export const dynamic = 'force-dynamic'
import { ReportCardDocument } from './pdf-document'

type RouteContext = { params: Promise<{ studentId: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session || !['admin', 'teacher'].includes(session.role)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { studentId } = await params
  const termId = req.nextUrl.searchParams.get('termId') ?? undefined

  const [student, school] = await Promise.all([
    db.student.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        classEnrolments: {
          where: { status: 'active' },
          include: {
            class: {
              include: {
                teachers: {
                  where: { isPrimary: true },
                  include: { staff: { include: { user: { select: { name: true } } } } },
                },
                gradebooks: {
                  where: termId ? { termId } : {},
                  include: {
                    term: true,
                    grades: {
                      where: { studentId },
                    },
                  },
                },
              },
            },
          },
        },
        attendance: {
          where: termId
            ? { termId }
            : {},
          orderBy: { date: 'desc' },
        },
      },
    }),
    db.schoolSettings.findFirst(),
  ])

  if (!student) {
    return new NextResponse('Student not found', { status: 404 })
  }

  // Compute attendance stats
  const totalAtt = student.attendance.length
  const presentCount = student.attendance.filter(a => a.status === 'present').length
  const absentCount = student.attendance.filter(a => a.status === 'absent').length
  const lateCount = student.attendance.filter(a => a.status === 'late').length
  const attRate = totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : null

  // Build grades by class
  const classSummaries = student.classEnrolments.map(enr => {
    const cls = enr.class
    const primaryTeacher = cls.teachers[0]?.staff.user.name ?? null
    const gradebooks = cls.gradebooks.map(gb => {
      const grade = gb.grades[0]
      return {
        name: gb.name,
        type: gb.type,
        maxScore: gb.maxScore,
        score: grade?.score ?? null,
        letterGrade: grade?.grade ?? null,
        comment: grade?.comment ?? null,
      }
    })
    const scores = gradebooks.map(g => g.score).filter((s): s is number => s !== null)
    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null
    return {
      className: cls.name,
      classCode: cls.code,
      subject: cls.subject,
      teacher: primaryTeacher,
      gradebooks,
      avg,
    }
  })

  const docElement = createElement(ReportCardDocument, {
    student: {
      name: student.user.name,
      studentId: student.studentId,
      yearLevel: student.yearLevel,
      email: student.user.email,
    },
    school: {
      name: school?.name ?? 'TPT School',
      shortName: school?.shortName ?? undefined,
      address: school?.address ?? undefined,
      phone: school?.phone ?? undefined,
    },
    attendance: { total: totalAtt, present: presentCount, absent: absentCount, late: lateCount, rate: attRate },
    classSummaries,
    generatedAt: new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }),
  })

  const buffer = await renderToBuffer(docElement as any)

  const safeName = student.user.name.replace(/[^a-z0-9]/gi, '_')
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-card-${safeName}.pdf"`,
    },
  })
}
