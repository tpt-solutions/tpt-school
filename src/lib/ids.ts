import "server-only";

import type { db } from "@/lib/db";
import type { Tx } from "@/lib/enrolment";

/**
 * Sequential human-readable IDs (STU-00012, EMP-0003).
 *
 * The next ID is derived from the highest existing ID, not from a row count:
 * a count collides with existing IDs once any record has been deleted, and it
 * gives two concurrent creates the same number. The unique constraint on the
 * ID column still backstops any remaining race, and `withIdRetry` retries it.
 */

type Client = Pick<Tx, "student" | "staff"> | Pick<typeof db, "student" | "staff">;

function formatNext(prefix: string, width: number, latest: string | undefined): string {
  const current = latest ? parseInt(latest.replace(/\D/g, ""), 10) : 0
  const next = (Number.isFinite(current) ? current : 0) + 1
  return `${prefix}-${String(next).padStart(width, "0")}`
}

export async function nextStudentId(client: Client): Promise<string> {
  const latest = await client.student.findFirst({
    orderBy: { studentId: "desc" },
    select: { studentId: true },
  })
  return formatNext("STU", 5, latest?.studentId)
}

export async function nextEmployeeId(client: Client): Promise<string> {
  const latest = await client.staff.findFirst({
    orderBy: { employeeId: "desc" },
    select: { employeeId: true },
  })
  return formatNext("EMP", 4, latest?.employeeId)
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002") return true
  return err instanceof Error && /unique constraint/i.test(err.message)
}

/** Re-runs a create when another request took the same ID between read and write. */
export async function withIdRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= attempts || !isUniqueViolation(err)) throw err
    }
  }
}
