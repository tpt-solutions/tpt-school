import 'server-only'
import { db } from '@/lib/db'

/**
 * Early-warning risk scoring. A student's score is the sum of points from a few signals:
 * attendance, grades, unpaid fees, recent behaviour incidents and open truancy alerts.
 * It is a prompt for staff to check in, not a judgement, so every point is explained in `reasons`.
 */

export type RiskMetrics = {
  attendanceRate: number | null // 0-100, over the attendance window
  averageGradePct: number | null // 0-100, over recent graded work
  overdueInvoices: number
  incidentsRecent: number
  openTruancyAlerts: number
}

export type RiskLevel = 'low' | 'medium' | 'high'

export type RiskResult = {
  score: number
  level: RiskLevel
  reasons: string[]
}

export function scoreRisk(m: RiskMetrics): RiskResult {
  let score = 0
  const reasons: string[] = []

  if (m.attendanceRate !== null) {
    if (m.attendanceRate < 80) {
      score += 35
      reasons.push(`Attendance ${m.attendanceRate}%`)
    } else if (m.attendanceRate < 90) {
      score += 20
      reasons.push(`Attendance ${m.attendanceRate}%`)
    }
  }

  if (m.averageGradePct !== null) {
    if (m.averageGradePct < 50) {
      score += 35
      reasons.push(`Average grade ${m.averageGradePct}%`)
    } else if (m.averageGradePct < 60) {
      score += 20
      reasons.push(`Average grade ${m.averageGradePct}%`)
    }
  }

  if (m.openTruancyAlerts > 0) {
    score += 15
    reasons.push(`${m.openTruancyAlerts} open truancy alert${m.openTruancyAlerts === 1 ? '' : 's'}`)
  }

  if (m.overdueInvoices >= 2) {
    score += 15
    reasons.push(`${m.overdueInvoices} overdue invoices`)
  } else if (m.overdueInvoices === 1) {
    score += 10
    reasons.push('1 overdue invoice')
  }

  if (m.incidentsRecent >= 4) {
    score += 25
    reasons.push(`${m.incidentsRecent} behaviour incidents in 30 days`)
  } else if (m.incidentsRecent >= 2) {
    score += 15
    reasons.push(`${m.incidentsRecent} behaviour incidents in 30 days`)
  }

  score = Math.min(100, score)
  const level: RiskLevel = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low'
  return { score, level, reasons }
}

export type StudentRisk = {
  studentId: string
  name: string
  yearLevel: number | null
  result: RiskResult
}

const ATTENDANCE_WINDOW_DAYS = 60
const GRADE_WINDOW_DAYS = 90
const INCIDENT_WINDOW_DAYS = 30

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

/**
 * Scores every active student. Uses a fixed number of grouped queries, not one per student,
 * so it stays cheap for a few thousand students.
 */
export async function computeStudentRisks(): Promise<StudentRisk[]> {
  const students = await db.student.findMany({
    where: { enrollmentStatus: 'active' },
    select: { id: true, yearLevel: true, user: { select: { name: true } } },
  })
  if (students.length === 0) return []
  const ids = students.map(s => s.id)

  const [attendance, grades, invoices, incidents, truancy] = await Promise.all([
    db.attendance.groupBy({
      by: ['studentId', 'status'],
      where: { studentId: { in: ids }, date: { gte: daysAgo(ATTENDANCE_WINDOW_DAYS) } },
      _count: { _all: true },
    }),
    db.grade.findMany({
      where: {
        studentId: { in: ids },
        score: { not: null },
        gradedAt: { gte: daysAgo(GRADE_WINDOW_DAYS) },
      },
      select: { studentId: true, score: true, gradebook: { select: { maxScore: true } } },
    }),
    db.feeInvoice.groupBy({
      by: ['studentId'],
      where: {
        studentId: { in: ids },
        status: { in: ['unpaid', 'partial', 'overdue'] },
        dueDate: { lt: new Date() },
      },
      _count: { _all: true },
    }),
    db.behaviourIncident.groupBy({
      by: ['studentId'],
      where: { studentId: { in: ids }, date: { gte: daysAgo(INCIDENT_WINDOW_DAYS) } },
      _count: { _all: true },
    }),
    db.truancyAlert.groupBy({
      by: ['studentId'],
      where: { studentId: { in: ids }, resolvedAt: null },
      _count: { _all: true },
    }),
  ])

  // Attendance: present and late both count as in school.
  const attTotals = new Map<string, { total: number; inSchool: number }>()
  for (const row of attendance) {
    const entry = attTotals.get(row.studentId) ?? { total: 0, inSchool: 0 }
    const n = row._count._all
    entry.total += n
    if (row.status === 'present' || row.status === 'late') entry.inSchool += n
    attTotals.set(row.studentId, entry)
  }

  // Grades: percentage of max score, averaged per student.
  const gradeTotals = new Map<string, { sum: number; n: number }>()
  for (const g of grades) {
    if (g.score == null || !g.gradebook.maxScore) continue
    const entry = gradeTotals.get(g.studentId) ?? { sum: 0, n: 0 }
    entry.sum += (g.score / g.gradebook.maxScore) * 100
    entry.n += 1
    gradeTotals.set(g.studentId, entry)
  }

  const countBy = (rows: { studentId: string; _count: { _all: number } }[]) =>
    new Map(rows.map(r => [r.studentId, r._count._all]))
  const invoiceCounts = countBy(invoices)
  const incidentCounts = countBy(incidents)
  const truancyCounts = countBy(truancy)

  return students
    .map(s => {
      const att = attTotals.get(s.id)
      const gr = gradeTotals.get(s.id)
      const metrics: RiskMetrics = {
        attendanceRate: att && att.total > 0 ? Math.round((att.inSchool / att.total) * 100) : null,
        averageGradePct: gr && gr.n > 0 ? Math.round(gr.sum / gr.n) : null,
        overdueInvoices: invoiceCounts.get(s.id) ?? 0,
        incidentsRecent: incidentCounts.get(s.id) ?? 0,
        openTruancyAlerts: truancyCounts.get(s.id) ?? 0,
      }
      return {
        studentId: s.id,
        name: s.user.name,
        yearLevel: s.yearLevel,
        result: scoreRisk(metrics),
      }
    })
    .sort((a, b) => b.result.score - a.result.score || a.name.localeCompare(b.name))
}
