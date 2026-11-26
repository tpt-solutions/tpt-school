import "server-only";

import { db } from "@/lib/db";
import { sendEmail, truancyEmailHtml } from "@/lib/email";

/**
 * Creates a truancy alert (and notifies the primary guardian) when a student
 * has 3+ consecutive or 10+ total unexcused absences in the term.
 *
 * Deliberately NOT a server action: it is internal and must never be
 * reachable directly from the client.
 */
export async function checkTruancy(studentId: string, termId: string): Promise<void> {
  const recentAttendance = await db.attendance.findMany({
    where: { studentId, termId },
    orderBy: { date: "desc" },
    take: 30,
  });

  let consecutive = 0;
  for (const record of recentAttendance) {
    if (record.status === "absent") consecutive++;
    else break;
  }

  const totalUnexcused = recentAttendance.filter(
    (r: { status: string }) => r.status === "absent"
  ).length;

  if (consecutive < 3 && totalUnexcused < 10) return;

  const existing = await db.truancyAlert.findFirst({
    where: { studentId, termId, resolvedAt: null },
  });
  if (existing) return;

  await db.truancyAlert.create({
    data: { studentId, termId, consecutiveAbsences: consecutive, totalUnexcused },
  });

  // Fire-and-forget email to primary guardian
  db.student
    .findUnique({
      where: { id: studentId },
      include: {
        user: { select: { name: true } },
        parents: {
          include: { parent: { include: { user: { select: { name: true, email: true } } } } },
        },
      },
    })
    .then((student) => {
      if (!student) return;
      const primaryParent = student.parents.find((sp) => sp.isPrimary)?.parent ?? student.parents[0]?.parent;
      if (!primaryParent?.user?.email) return;
      db.schoolSettings
        .findFirst()
        .then((settings) => {
          const schoolName = settings?.name ?? "School";
          return sendEmail({
            to: primaryParent.user.email,
            subject: `Attendance alert — ${student.user.name}`,
            html: truancyEmailHtml(primaryParent.user.name, student.user.name, consecutive, totalUnexcused, schoolName),
          });
        })
        .catch(() => {});
    })
    .catch(() => {});
}
