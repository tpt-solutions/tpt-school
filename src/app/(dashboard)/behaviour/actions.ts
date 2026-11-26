"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { canAccessStudent } from "@/lib/access";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendEmail, behaviourEmailHtml } from "@/lib/email";

export async function createIncidentAction(formData: FormData) {
  const session = await requireRole(["admin", "teacher"]);

  const studentId = formData.get("studentId") as string;
  const date = new Date(formData.get("date") as string);
  const description = formData.get("description") as string;
  const location = formData.get("location") as string | null;
  const severity = (formData.get("severity") as string) || "minor";
  const witnesses = formData.get("witnesses") as string | null;
  const actionTaken = formData.get("actionTaken") as string | null;
  const parentNotified = formData.get("parentNotified") === "on";
  const followUpRequired = formData.get("followUpRequired") === "on";

  try {
    const incident = await db.behaviourIncident.create({
      data: {
        studentId,
        reportedById: session.id,
        date,
        description,
        location: location || null,
        severity,
        witnesses: witnesses || null,
        actionTaken: actionTaken || null,
        parentNotified,
        parentNotifiedAt: parentNotified ? new Date() : null,
        followUpRequired,
      },
    });

    // Fire-and-forget email to parents if parentNotified flag was set
    if (parentNotified) {
      db.student.findUnique({
        where: { id: studentId },
        include: {
          user: { select: { name: true } },
          parents: { include: { parent: { include: { user: { select: { name: true, email: true } } } } } },
        },
      }).then(student => {
        if (!student) return
        const schoolName$ = db.schoolSettings.findFirst().then(s => s?.name ?? 'School')
        const primaryParent = student.parents.find(sp => sp.isPrimary)?.parent ?? student.parents[0]?.parent
        if (!primaryParent?.user?.email) return
        const parentEmail = primaryParent.user.email
        const parentName = primaryParent.user.name
        schoolName$.then(schoolName => {
          sendEmail({
            to: parentEmail,
            subject: `Behaviour notification — ${student.user.name}`,
            html: behaviourEmailHtml(parentName, student.user.name, date, severity, schoolName),
          }).catch(() => {})
        })
      }).catch(() => {})
    }

    revalidatePath(`/students/${studentId}`);
    revalidatePath("/behaviour");
    redirect(`/behaviour/${incident.id}`);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    return { success: false, error: "Failed to create incident record" };
  }
}

export async function updateIncidentAction(id: string, formData: FormData) {
  await requireRole(["admin", "teacher"]);

  try {
    const incident = await db.behaviourIncident.update({
      where: { id },
      data: {
        description: formData.get("description") as string,
        location: (formData.get("location") as string) || null,
        severity: formData.get("severity") as string,
        witnesses: (formData.get("witnesses") as string) || null,
        actionTaken: (formData.get("actionTaken") as string) || null,
        parentNotified: formData.get("parentNotified") === "on",
        followUpRequired: formData.get("followUpRequired") === "on",
        followUpNotes: (formData.get("followUpNotes") as string) || null,
      },
    });
    revalidatePath(`/behaviour/${id}`);
    revalidatePath(`/students/${incident.studentId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update incident" };
  }
}

export async function createSuspensionAction(
  incidentId: string | null,
  formData: FormData
) {
  const session = await requireRole(["admin"]);

  const studentId = formData.get("studentId") as string;
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = new Date(formData.get("endDate") as string);
  const totalDays = Math.max(
    1,
    Math.round(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1
  );

  try {
    await db.suspension.create({
      data: {
        studentId,
        incidentId: incidentId || null,
        type: (formData.get("type") as string) || "out-of-school",
        startDate,
        endDate,
        totalDays,
        reason: formData.get("reason") as string,
        returnConditions: (formData.get("returnConditions") as string) || null,
        authorisedBy: session.id,
        parentNotified: formData.get("parentNotified") === "on",
      },
    });
    revalidatePath(`/students/${studentId}`);
    revalidatePath("/behaviour");
    if (incidentId) revalidatePath(`/behaviour/${incidentId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create suspension" };
  }
}

export async function exitStudentAction(formData: FormData) {
  await requireRole(["admin"]);

  const studentId = formData.get("studentId") as string;
  const exitType = formData.get("exitType") as string;
  const exitDate = new Date(formData.get("exitDate") as string);

  try {
    await db.$transaction([
      db.studentExit.create({
        data: {
          studentId,
          exitType,
          exitDate,
          reason: (formData.get("reason") as string) || null,
          destinationSchool:
            (formData.get("destinationSchool") as string) || null,
          notes: (formData.get("notes") as string) || null,
          documentsIssued: formData.get("documentsIssued") === "on",
        },
      }),
      db.student.update({
        where: { id: studentId },
        data: {
          enrollmentStatus:
            exitType === "transferred"
              ? "transferred"
              : exitType === "graduated"
                ? "graduated"
                : "inactive",
        },
      }),
      db.user.updateMany({
        where: { studentProfile: { id: studentId } },
        data: { active: false },
      }),
    ]);
    revalidatePath(`/students/${studentId}`);
    revalidatePath("/students");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to process student exit" };
  }
}

export async function resolveTruancyAlertAction(alertId: string, notes: string) {
  const session = await requireRole(["admin", "teacher"]);

  const alert = await db.truancyAlert.findUnique({
    where: { id: alertId },
    select: { studentId: true, resolvedAt: true },
  });
  if (!alert) return { success: false, error: "Alert not found." };
  if (!(await canAccessStudent(session, alert.studentId))) {
    return { success: false, error: "You are not authorised to resolve this alert." };
  }
  if (alert.resolvedAt) return { success: false, error: "Alert is already resolved." };

  await db.truancyAlert.update({
    where: { id: alertId },
    data: { resolvedAt: new Date(), resolvedBy: session.id, notes: notes?.trim() || null },
  });
  revalidatePath("/behaviour");
  return { success: true };
}
