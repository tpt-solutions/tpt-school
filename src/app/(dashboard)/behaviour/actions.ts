"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { canAccessStudent } from "@/lib/access";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendEmail, behaviourEmailHtml } from "@/lib/email";
import { z } from "zod";
import { field, checkbox, formRecord, parseWith } from "@/lib/form";
import { checkDateRange } from "@/lib/validation";

const SEVERITIES = ["minor", "moderate", "major", "critical"] as const;
const SUSPENSION_TYPES = ["in-school", "out-of-school"] as const;
const EXIT_TYPES = ["withdrawn", "transferred", "expelled", "graduated", "deceased", "other"] as const;

const incidentSchema = z.object({
  studentId: field.required("Student", 64),
  date: field.date("Date"),
  description: field.required("Description", 5000),
  location: field.optional("Location", 200),
  severity: field.oneOf("Severity", SEVERITIES).default("minor"),
  witnesses: field.optional("Witnesses", 1000),
  actionTaken: field.optional("Action taken", 2000),
});

export async function createIncidentAction(formData: FormData) {
  const session = await requireRole(["admin", "teacher"]);

  const parsed = parseWith(incidentSchema, formRecord(formData));
  if (!parsed.ok) return { success: false, error: parsed.error };
  const { studentId, date, description, location, severity, witnesses, actionTaken } = parsed.data;
  const parentNotified = checkbox(formData.get("parentNotified") as string | null);
  const followUpRequired = checkbox(formData.get("followUpRequired") as string | null);

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

  const suspensionSchema = z.object({
    studentId: field.required("Student", 64),
    type: field.oneOf("Suspension type", SUSPENSION_TYPES).default("out-of-school"),
    startDate: field.date("Start date"),
    endDate: field.date("End date"),
    reason: field.required("Reason", 2000),
    returnConditions: field.optional("Return conditions", 2000),
  });
  const parsed = parseWith(suspensionSchema, formRecord(formData));
  if (!parsed.ok) return { success: false, error: parsed.error };
  const { studentId, type, startDate, endDate, reason, returnConditions } = parsed.data;
  const rangeError = checkDateRange(startDate.toISOString(), endDate.toISOString());
  if (rangeError) return { success: false, error: rangeError };

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
        type,
        startDate,
        endDate,
        totalDays,
        reason,
        returnConditions,
        authorisedBy: session.id,
        parentNotified: checkbox(formData.get("parentNotified") as string | null),
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

  const exitSchema = z.object({
    studentId: field.required("Student", 64),
    exitType: field.oneOf("Exit type", EXIT_TYPES),
    exitDate: field.date("Exit date"),
    reason: field.optional("Reason", 2000),
    destinationSchool: field.optional("Destination school", 200),
    notes: field.optional("Notes", 4000),
  });
  const parsed = parseWith(exitSchema, formRecord(formData));
  if (!parsed.ok) return { success: false, error: parsed.error };
  const { studentId, exitType, exitDate, reason, destinationSchool, notes } = parsed.data;

  try {
    await db.$transaction([
      db.studentExit.create({
        data: {
          studentId,
          exitType,
          exitDate,
          reason,
          destinationSchool,
          notes,
          documentsIssued: checkbox(formData.get("documentsIssued") as string | null),
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
