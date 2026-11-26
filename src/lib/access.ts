import "server-only";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export class ForbiddenError extends Error {
  constructor(message = "You are not authorised to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** True if the session user may act on this class (admins always; teachers only if assigned). */
export async function teachesClass(session: SessionUser, classId: string): Promise<boolean> {
  if (session.role === "admin") return true;
  if (session.role !== "teacher") return false;
  const link = await db.classTeacher.findFirst({
    where: { classId, staff: { userId: session.id } },
    select: { classId: true },
  });
  return link !== null;
}

/** Throws ForbiddenError unless the session user teaches the class (admins pass). */
export async function assertTeachesClass(session: SessionUser, classId: string): Promise<void> {
  if (!(await teachesClass(session, classId))) {
    throw new ForbiddenError("You are not a teacher of this class.");
  }
}

/** True if the session user may view/edit records for this student (admins; teachers of an active class of the student). */
export async function canAccessStudent(session: SessionUser, studentId: string): Promise<boolean> {
  if (session.role === "admin") return true;
  if (session.role !== "teacher") return false;
  const enrolment = await db.classEnrolment.findFirst({
    where: {
      studentId,
      status: "active",
      class: { teachers: { some: { staff: { userId: session.id } } } },
    },
    select: { id: true },
  });
  return enrolment !== null;
}

/** Student profile IDs linked to a user: the student themself, or the children of a parent. */
async function linkedStudentIds(userId: string, role: string): Promise<string[]> {
  if (role === "student") {
    const s = await db.student.findUnique({ where: { userId }, select: { id: true } });
    return s ? [s.id] : [];
  }
  if (role === "parent") {
    const links = await db.studentParent.findMany({
      where: { parent: { userId } },
      select: { studentId: true },
    });
    return links.map((l) => l.studentId);
  }
  return [];
}

/** True if any of the given students is actively enrolled in a class taught by the teacher user. */
async function teacherTeachesAnyOf(teacherUserId: string, studentIds: string[]): Promise<boolean> {
  if (studentIds.length === 0) return false;
  const enrolment = await db.classEnrolment.findFirst({
    where: {
      studentId: { in: studentIds },
      status: "active",
      class: { teachers: { some: { staff: { userId: teacherUserId } } } },
    },
    select: { id: true },
  });
  return enrolment !== null;
}

/**
 * Messaging rules:
 * - Admins may message anyone.
 * - Anyone may message an admin.
 * - Staff (teacher) may message other staff, and parents/students whose child they teach.
 * - Parents/students may message teachers who teach their child.
 * - Parents/students may not message each other directly.
 */
export async function canMessage(sender: SessionUser, recipientUserId: string): Promise<boolean> {
  if (sender.id === recipientUserId) return false;
  if (sender.role === "admin") return true;

  const recipient = await db.user.findUnique({
    where: { id: recipientUserId },
    select: { role: true, active: true },
  });
  if (!recipient || !recipient.active) return false;
  if (recipient.role === "admin") return true;

  if (sender.role === "teacher") {
    if (recipient.role === "teacher") return true;
    const studentIds = await linkedStudentIds(recipientUserId, recipient.role);
    return teacherTeachesAnyOf(sender.id, studentIds);
  }

  if (sender.role === "parent" || sender.role === "student") {
    if (recipient.role !== "teacher") return false;
    const studentIds = await linkedStudentIds(sender.id, sender.role);
    return teacherTeachesAnyOf(recipientUserId, studentIds);
  }

  return false;
}
