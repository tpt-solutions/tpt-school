import "server-only";

import { db } from "@/lib/db";
import { enqueueEmail } from "@/lib/email-queue";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Queues the "set up your account" email for a newly imported person. The email carries no
 * reset link or token: the queue stores bodies in plain text until they are sent, so the
 * person is told to use Forgot password with their own address instead. Queued, not sent
 * inline, so a large import does not wait on SMTP.
 */
export async function queueAccountSetupEmail(email: string, name: string): Promise<void> {
  const settings = await db.schoolSettings.findFirst({ select: { name: true } });
  const schoolName = settings?.name ?? "your school";
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const forgotUrl = `${baseUrl}/forgot-password`;

  await enqueueEmail({
    to: email,
    subject: `Set up your ${schoolName} account`,
    html: `
      <p>Hi ${escapeHtml(name)},</p>
      <p>An account has been created for you at ${escapeHtml(schoolName)}.</p>
      <p>To choose your password, go to <a href="${escapeHtml(forgotUrl)}">${escapeHtml(forgotUrl)}</a>,
      enter this email address, and follow the link we send you.</p>
    `,
    text: `An account has been created for you at ${schoolName}.\n\nTo choose your password, go to ${forgotUrl}, enter this email address, and follow the link we send you.`,
  });
}
