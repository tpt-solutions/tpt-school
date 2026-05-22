import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { IncidentForm } from "../incident-form";

export default async function NewIncidentPage() {
  await requireRole(["admin", "teacher"]);

  const students = await db.student.findMany({
    where: { enrollmentStatus: "active" },
    include: { user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Log Incident</h1>
        <p className="text-sm text-gray-500">
          Record a behaviour or wellbeing incident.
        </p>
      </div>
      <IncidentForm students={students.map((s: { id: string; studentId: string; user: { name: string } }) => ({ id: s.id, name: s.user.name, studentId: s.studentId }))} />
    </div>
  );
}
