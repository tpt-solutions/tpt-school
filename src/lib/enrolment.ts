import "server-only";

import type { db } from "@/lib/db";

/**
 * Helpers for class enrolment and waitlists. Every function here takes a
 * transaction client, so callers must run them inside `db.$transaction(...)`.
 * SQLite allows one writer at a time and Prisma holds the connection for the
 * duration of an interactive transaction, so the count-then-insert below cannot
 * interleave with another enrolment.
 */

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export class ClassFullError extends Error {
  constructor() {
    super("This class is full.");
    this.name = "ClassFullError";
  }
}

/** Enrols a student only if the class has space (maxStudents is null = unlimited). */
export async function enrolInTx(tx: Tx, classId: string, studentId: string): Promise<void> {
  const cls = await tx.class.findUnique({
    where: { id: classId },
    select: {
      maxStudents: true,
      _count: { select: { enrolments: { where: { status: "active" } } } },
    },
  });
  if (!cls) throw new Error("Class not found.");
  if (cls.maxStudents !== null && cls._count.enrolments >= cls.maxStudents) {
    throw new ClassFullError();
  }
  await tx.classEnrolment.create({ data: { classId, studentId, status: "active" } });
}

/** Appends a student to the end of a class waitlist with the next free position. */
export async function appendToWaitlistTx(
  tx: Tx,
  classId: string,
  studentId: string,
  notes: string | null = null,
) {
  const last = await tx.waitlistEntry.findFirst({
    where: { classId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return tx.waitlistEntry.create({
    data: { classId, studentId, position: (last?.position ?? 0) + 1, notes },
  });
}

/** Re-sequences waitlist positions to 1..n, keeping their order. */
export async function renumberWaitlistTx(tx: Tx, classId: string): Promise<void> {
  const remaining = await tx.waitlistEntry.findMany({
    where: { classId },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  for (let i = 0; i < remaining.length; i++) {
    await tx.waitlistEntry.update({ where: { id: remaining[i].id }, data: { position: i + 1 } });
  }
}
