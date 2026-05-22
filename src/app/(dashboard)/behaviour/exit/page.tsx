import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ExitForm } from "../exit-form";

export default async function StudentExitPage() {
  await requireRole(["admin"]);

  const students = await db.student.findMany({
    where: { enrollmentStatus: "active" },
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Process Student Exit
        </h1>
        <p className="text-sm text-gray-500">
          Use this form for withdrawals, transfers, expulsions, and graduations.
          The student&apos;s account will be deactivated and their enrolment
          status updated.
        </p>
      </div>
      <ExitForm
        students={students.map((s: { id: string; studentId: string; user: { name: string } }) => ({
          id: s.id,
          name: s.user.name,
          studentId: s.studentId,
        }))}
      />
    </div>
  );
}
