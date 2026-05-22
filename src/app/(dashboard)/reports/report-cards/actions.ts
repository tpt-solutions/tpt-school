'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { generateReportComment, ReportCardContext } from '@/lib/ai'
import { sendEmail, reportCardEmailHtml } from '@/lib/email'

// ─── Build AI context for a student ──────────────────────────────────────────

async function buildReportCardContext(studentId: string, termId?: string): Promise<ReportCardContext> {
  const student = await db.student.findUniqueOrThrow({
    where: { id: studentId },
    include: {
      user: { select: { name: true } },
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
                include: { grades: { where: { studentId } } },
              },
            },
          },
        },
      },
      attendance: {
        where: termId ? { termId } : {},
      },
      behaviourIncidents: {
        where: termId
          ? { date: { gte: (await db.term.findUnique({ where: { id: termId } }))?.startDate } }
          : {},
      },
    },
  })

  const totalAtt = student.attendance.length
  const presentCount = student.attendance.filter(a => a.status === 'present').length
  const absenceCount = student.attendance.filter(a => a.status === 'absent').length
  const attRate = totalAtt > 0 ? (presentCount / totalAtt) * 100 : 100

  const classes = student.classEnrolments.map(enr => {
    const cls = enr.class
    const teacher = cls.teachers[0]?.staff.user.name ?? 'Staff'
    const scores = cls.gradebooks.flatMap(gb => gb.grades).map(g => g.score).filter((s): s is number => s !== null)
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
    const letterGrade = cls.gradebooks.flatMap(gb => gb.grades)[0]?.grade ?? null
    return { name: cls.name, teacher, letterGrade, averageScore: avg }
  })

  const termName = termId
    ? (await db.term.findUnique({ where: { id: termId }, include: { academicYear: true } }))
        ?.name ?? 'Current Term'
    : 'Current Term'

  const behaviourSeverities = student.behaviourIncidents.map(i => i.severity)

  return {
    studentName: student.user.name.split(' ')[0] ?? student.user.name,
    yearLevel: student.yearLevel,
    termName,
    classes,
    attendanceRate: attRate,
    absenceCount,
    behaviourIncidentCount: student.behaviourIncidents.length,
    behaviourSeverities,
  }
}

// ─── Generate comment for one student (assist mode) ──────────────────────────

export async function generateReportCommentAction(
  studentId: string,
  termId?: string,
): Promise<{ success: boolean; comment?: string; error?: string }> {
  try {
    await requireRole(['admin', 'teacher'])
    const context = await buildReportCardContext(studentId, termId)
    const comment = await generateReportComment(context)
    return { success: true, comment }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to generate comment.' }
  }
}

// ─── Save report card comments ────────────────────────────────────────────────

export async function saveReportCardAction(
  studentId: string,
  termId: string,
  data: { comments?: string; teacherNotes?: string; principalNotes?: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin', 'teacher'])

    const term = await db.term.findUnique({ where: { id: termId }, include: { academicYear: true } })
    if (!term) return { success: false, error: 'Term not found.' }

    await db.reportCard.upsert({
      where: { studentId_termId: { studentId, termId } },
      create: {
        studentId,
        termId,
        academicYear: term.academicYear.year,
        comments: data.comments ?? null,
        teacherNotes: data.teacherNotes ?? null,
        principalNotes: data.principalNotes ?? null,
      },
      update: {
        comments: data.comments ?? null,
        teacherNotes: data.teacherNotes ?? null,
        principalNotes: data.principalNotes ?? null,
      },
    })

    revalidatePath('/reports/report-cards')
    return { success: true }
  } catch (err) {
    console.error('saveReportCardAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── Publish all report cards for a term (auto AI mode) ──────────────────────

export async function publishReportCardsAction(
  termId: string,
): Promise<{ success: boolean; generated: number; error?: string }> {
  try {
    await requireRole(['admin'])

    const settings = await db.schoolSettings.findFirst()
    const aiEnabled = settings?.aiProvider && settings.aiProvider !== 'none' && settings.aiReportMode === 'auto'

    const term = await db.term.findUnique({ where: { id: termId }, include: { academicYear: true } })
    if (!term) return { success: false, generated: 0, error: 'Term not found.' }

    const students = await db.student.findMany({
      where: { enrollmentStatus: 'active' },
      include: { user: { select: { name: true } } },
    })

    let generated = 0

    for (const student of students) {
      const existing = await db.reportCard.findUnique({
        where: { studentId_termId: { studentId: student.id, termId } },
      })

      let comments = existing?.comments ?? null

      if (aiEnabled && !comments) {
        try {
          const context = await buildReportCardContext(student.id, termId)
          comments = await generateReportComment(context)
          generated++
        } catch {
          // Skip if AI fails for one student
        }
      }

      await db.reportCard.upsert({
        where: { studentId_termId: { studentId: student.id, termId } },
        create: {
          studentId: student.id,
          termId,
          academicYear: term.academicYear.year,
          comments,
          published: true,
          issuedAt: new Date(),
        },
        update: {
          published: true,
          issuedAt: new Date(),
          ...(comments ? { comments } : {}),
        },
      })
    }

    // Fire-and-forget email notifications to parents
    if (students.length > 0) {
      Promise.all(
        students.map(student =>
          db.student.findUnique({
            where: { id: student.id },
            include: {
              parents: { include: { parent: { include: { user: { select: { name: true, email: true } } } } } },
            },
          }).then(s => {
            if (!s) return
            const primaryParent = s.parents.find(sp => sp.isPrimary)?.parent ?? s.parents[0]?.parent
            if (!primaryParent?.user?.email) return
            return sendEmail({
              to: primaryParent.user.email,
              subject: `Report card published — ${student.user.name}`,
              html: reportCardEmailHtml(primaryParent.user.name, student.user.name, term.name, settings?.name ?? 'School'),
            })
          })
        )
      ).catch(() => {})
    }

    revalidatePath('/reports/report-cards')
    return { success: true, generated }
  } catch (err) {
    console.error('publishReportCardsAction error:', err)
    return { success: false, generated: 0, error: 'An unexpected error occurred.' }
  }
}
