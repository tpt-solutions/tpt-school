import 'server-only'
import { db } from '@/lib/db'
import type { SessionUser } from '@/lib/auth'

export type LinkedStudent = { id: string; name: string; yearLevel: number | null }

/**
 * Students a parent or student account may see in the portal.
 * Parents get their linked children; students get their own record; staff get an empty list
 * (they use the staff pages instead).
 */
export async function linkedStudentsFor(user: SessionUser): Promise<LinkedStudent[]> {
  if (user.role === 'parent') {
    const links = await db.studentParent.findMany({
      where: { parent: { userId: user.id } },
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { student: { user: { name: 'asc' } } },
    })
    return links.map(l => ({
      id: l.student.id,
      name: l.student.user.name,
      yearLevel: l.student.yearLevel,
    }))
  }
  if (user.role === 'student') {
    const s = await db.student.findUnique({
      where: { userId: user.id },
      include: { user: { select: { name: true } } },
    })
    return s ? [{ id: s.id, name: s.user.name, yearLevel: s.yearLevel }] : []
  }
  return []
}

/**
 * Whether a parent or student may download this student's report card for this term.
 * Only published report cards are visible to families.
 */
export async function canViewPublishedReportCard(
  user: SessionUser,
  studentId: string,
  termId: string,
): Promise<boolean> {
  const linked = await linkedStudentsFor(user)
  if (!linked.some(s => s.id === studentId)) return false
  const card = await db.reportCard.findUnique({
    where: { studentId_termId: { studentId, termId } },
    select: { published: true },
  })
  return card?.published === true
}
