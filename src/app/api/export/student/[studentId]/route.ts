import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ studentId: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { studentId } = await params
  const format = req.nextUrl.searchParams.get('format') ?? 'json'

  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      user: true,
      parents: { include: { parent: { include: { user: true } } } },
      classEnrolments: { include: { class: { select: { name: true, code: true, subject: true } } } },
      attendance: { orderBy: { date: 'desc' } },
      grades: { include: { gradebook: { select: { name: true, type: true, maxScore: true } } } },
      feeInvoices: { include: { items: true, payments: true } },
      behaviourIncidents: true,
      suspensions: true,
      documents: true,
      exitRecord: true,
    },
  })

  if (!student) {
    return new NextResponse('Student not found', { status: 404 })
  }

  await logAudit(session.id, 'EXPORT', 'Student', `Exported data for ${student.user.name}`, studentId)

  const data = {
    exportedAt: new Date().toISOString(),
    exportedBy: session.email,
    student: {
      id: student.studentId,
      name: student.user.name,
      email: student.user.email,
      phone: student.user.phone,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      yearLevel: student.yearLevel,
      enrollmentDate: student.enrollmentDate,
      enrollmentStatus: student.enrollmentStatus,
      nationality: student.nationality,
      address: student.address,
      medical: {
        conditions: student.medicalConditions,
        allergies: student.allergies,
        medications: student.medications,
        doctorName: student.doctorName,
        doctorPhone: student.doctorPhone,
      },
      emergency: {
        name: student.emergencyName,
        phone: student.emergencyPhone,
        relation: student.emergencyRelation,
      },
    },
    parents: student.parents.map(sp => ({
      name: sp.parent.user.name,
      email: sp.parent.user.email,
      relationship: sp.parent.relationship,
      isPrimary: sp.isPrimary,
    })),
    classes: student.classEnrolments.map(e => ({
      class: e.class.name,
      code: e.class.code,
      subject: e.class.subject,
      enrolledAt: e.enrolledAt,
      status: e.status,
    })),
    attendance: student.attendance.map(a => ({
      date: a.date,
      status: a.status,
      notes: a.notes,
    })),
    grades: student.grades.map(g => ({
      assessment: g.gradebook.name,
      type: g.gradebook.type,
      maxScore: g.gradebook.maxScore,
      score: g.score,
      letterGrade: g.grade,
      comment: g.comment,
      gradedAt: g.gradedAt,
    })),
    fees: {
      invoices: student.feeInvoices.map(inv => ({
        id: inv.id,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        status: inv.status,
        total: inv.totalAmount,
        paid: inv.paidAmount,
        items: inv.items.map(i => ({ description: i.description, amount: i.amount })),
        payments: inv.payments.map(p => ({ amount: p.amount, method: p.method, date: p.paidAt })),
      })),
    },
    behaviour: {
      incidents: student.behaviourIncidents.map(b => ({
        date: b.date,
        severity: b.severity,
        location: b.location,
        actionTaken: b.actionTaken,
      })),
      suspensions: student.suspensions.map(s => ({
        type: s.type,
        startDate: s.startDate,
        endDate: s.endDate,
        totalDays: s.totalDays,
        reason: s.reason,
      })),
    },
    exitRecord: student.exitRecord
      ? { type: student.exitRecord.exitType, date: student.exitRecord.exitDate, reason: student.exitRecord.reason }
      : null,
  }

  if (format === 'csv') {
    // Flatten to a single attendance-focus CSV for basic export
    const rows = student.attendance.map(a => [
      student.user.name,
      student.studentId,
      a.date.toISOString().slice(0, 10),
      a.status,
      a.notes ?? '',
    ])
    const csv = [
      ['Name', 'Student ID', 'Date', 'Status', 'Notes'].join(','),
      ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const safeName = student.user.name.replace(/[^a-z0-9]/gi, '_')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="student-export-${safeName}.csv"`,
      },
    })
  }

  const safeName = student.user.name.replace(/[^a-z0-9]/gi, '_')
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="student-export-${safeName}.json"`,
    },
  })
}
