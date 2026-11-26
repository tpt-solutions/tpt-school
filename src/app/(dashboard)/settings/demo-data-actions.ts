'use server'

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword, requireRole } from '@/lib/auth'
import { nextEmployeeId, nextStudentId, withIdRetry } from '@/lib/ids'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

const DEMO_STUDENTS = [
  { first: 'Ava', last: 'Demo', level: 7 },
  { first: 'Liam', last: 'Demo', level: 7 },
  { first: 'Mia', last: 'Demo', level: 7 },
  { first: 'Noah', last: 'Demo', level: 8 },
  { first: 'Zara', last: 'Demo', level: 8 },
  { first: 'Ethan', last: 'Demo', level: 8 },
]

function randomPassword(): string {
  return randomBytes(18).toString('base64url')
}

/**
 * Loads a small set of obviously fake records (names end in "Demo", emails use example.com)
 * so an admin can try the system. Only runs on a school with no students and no staff, so
 * sample people can never be mixed into a live roster. Demo accounts get random passwords
 * that nobody knows; they exist only to be looked at and can be deactivated.
 */
export async function loadDemoDataAction(): Promise<{ success: boolean; error?: string; summary?: string }> {
  const actor = await requireRole(['admin'])

  const [studentCount, staffCount, activeYear] = await Promise.all([
    db.student.count(),
    db.staff.count(),
    db.academicYear.findFirst({ where: { active: true }, select: { id: true } }),
  ])
  if (studentCount > 0 || staffCount > 0) {
    return { success: false, error: 'Demo data can only be loaded into a school with no students or staff.' }
  }
  if (!activeYear) return { success: false, error: 'Set an active academic year first.' }

  const teacherPassword = await hashPassword(randomPassword())
  const studentPasswords = await Promise.all(DEMO_STUDENTS.map(() => hashPassword(randomPassword())))

  await withIdRetry(() => db.$transaction(async (tx) => {
    const teacherUser = await tx.user.create({
      data: { email: 'demo.teacher@example.com', passwordHash: teacherPassword, name: 'Taylor Demo', role: 'teacher', active: true },
    })
    const employeeId = await nextEmployeeId(tx)
    const teacher = await tx.staff.create({
      data: { userId: teacherUser.id, employeeId, jobTitle: 'Demo teacher', employmentType: 'full-time' },
    })

    const classes = [
      { code: 'DEMO-7', name: 'Demo Year 7 Class', yearLevel: 7 },
      { code: 'DEMO-8', name: 'Demo Year 8 Class', yearLevel: 8 },
    ]
    const createdClasses: Record<number, string> = {}
    for (const c of classes) {
      const cls = await tx.class.create({
        data: { academicYearId: activeYear.id, name: c.name, code: c.code, yearLevel: c.yearLevel, subject: 'Demo' },
      })
      await tx.classTeacher.create({ data: { classId: cls.id, staffId: teacher.id, isPrimary: true } })
      createdClasses[c.yearLevel] = cls.id
    }

    for (let i = 0; i < DEMO_STUDENTS.length; i++) {
      const s = DEMO_STUDENTS[i]
      const studentId = await nextStudentId(tx)
      const user = await tx.user.create({
        data: {
          email: `demo.student${i + 1}@example.com`,
          passwordHash: studentPasswords[i],
          name: `${s.first} ${s.last}`,
          role: 'student',
          active: true,
        },
      })
      const student = await tx.student.create({
        data: { userId: user.id, studentId, yearLevel: s.level },
      })
      await tx.classEnrolment.create({ data: { classId: createdClasses[s.level], studentId: student.id } })
    }
  }))

  await logAudit(actor.id, 'CREATE', 'Demo', `Loaded demo data: ${DEMO_STUDENTS.length} students, 1 teacher, 2 classes`)
  revalidatePath('/dashboard')
  revalidatePath('/students')
  revalidatePath('/classes')
  return { success: true, summary: `Added ${DEMO_STUDENTS.length} demo students, 1 demo teacher and 2 demo classes.` }
}
