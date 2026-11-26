import { db } from '@/lib/db'
import type { SchoolSettings } from '@/generated/prisma/client'
import { decrypt } from '@/lib/crypto'
import { centsToDecimalString } from '@/lib/money'

export type EmailPayload = {
  to: string
  subject: string
  html: string
  text?: string
  /** Stored in EmailLog instead of the body — use for emails containing secrets (reset links). */
  logBody?: string
}

const EMAIL_MAX_ATTEMPTS = 3
const EMAIL_RETRY_BASE_MS = 1000

async function deliverOnce(
  provider: string,
  payload: EmailPayload,
  settings: SchoolSettings,
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (provider) {
      case 'resend':
        return await sendViaResend(payload, decrypt(settings.resendApiKey ?? ''), settings)
      case 'mailjet':
        return await sendViaMailjet(
          payload,
          decrypt(settings.mailjetApiKey ?? ''),
          decrypt(settings.mailjetSecret ?? ''),
          settings,
        )
      case 'sendgrid':
        return await sendViaSendGrid(payload, decrypt(settings.sendgridApiKey ?? ''), settings)
      default:
        return await sendViaSmtp(payload, settings)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Email send failed.'
    return { success: false, error: msg }
  }
}

export async function sendEmail(
  payload: EmailPayload,
): Promise<{ success: boolean; error?: string }> {
  const settings = await db.schoolSettings.findFirst()
  if (!settings) return { success: false, error: 'School settings not configured.' }

  const provider = settings.emailProvider ?? 'smtp'
  let result: { success: boolean; error?: string } = { success: false, error: 'Email send failed.' }

  // Transient failures (timeouts, provider 5xx) usually clear within seconds, so retry with backoff.
  for (let attempt = 1; attempt <= EMAIL_MAX_ATTEMPTS; attempt++) {
    result = await deliverOnce(provider, payload, settings)
    if (result.success) break
    if (attempt < EMAIL_MAX_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, EMAIL_RETRY_BASE_MS * 2 ** (attempt - 1)))
    }
  }

  // Log to EmailLog (fire-and-forget)
  db.emailLog
    .create({
      data: {
        to: payload.to,
        subject: payload.subject,
        body: payload.logBody ?? payload.text ?? payload.html,
        status: result.success ? 'sent' : 'failed',
        sentAt: result.success ? new Date() : null,
        error: result.error ?? null,
      },
    })
    .catch(() => {})

  return result
}

async function sendViaSmtp(payload: EmailPayload, settings: SchoolSettings) {
  if (!settings.smtpHost) return { success: false, error: 'SMTP not configured.' }
  const nodemailer = await import('nodemailer')
  const smtpPass = decrypt(settings.smtpPass ?? '')
  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort ?? 587,
    auth: settings.smtpUser && smtpPass ? { user: settings.smtpUser, pass: smtpPass } : undefined,
  })
  await transporter.sendMail({
    from: settings.smtpFrom ?? settings.smtpUser ?? 'noreply@school.com',
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  })
  return { success: true }
}

async function sendViaResend(payload: EmailPayload, apiKey: string, settings: SchoolSettings) {
  if (!apiKey) return { success: false, error: 'Resend API key not configured.' }
  const fromAddress = settings.smtpFrom ?? `noreply@${settings.email?.split('@')[1] ?? 'school.com'}`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromAddress, to: payload.to, subject: payload.subject, html: payload.html, text: payload.text }),
  })
  if (!res.ok) {
    const err = await res.text()
    return { success: false, error: `Resend error: ${err}` }
  }
  return { success: true }
}

async function sendViaMailjet(payload: EmailPayload, apiKey: string, secret: string, settings: SchoolSettings) {
  if (!apiKey || !secret) return { success: false, error: 'Mailjet credentials not configured.' }
  const fromAddress = settings.smtpFrom ?? `noreply@school.com`
  const fromName = settings.name ?? 'School'
  const body = {
    Messages: [{
      From: { Email: fromAddress, Name: fromName },
      To: [{ Email: payload.to }],
      Subject: payload.subject,
      HTMLPart: payload.html,
      TextPart: payload.text ?? '',
    }],
  }
  const res = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${apiKey}:${secret}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    return { success: false, error: `Mailjet error: ${err}` }
  }
  return { success: true }
}

async function sendViaSendGrid(payload: EmailPayload, apiKey: string, settings: SchoolSettings) {
  if (!apiKey) return { success: false, error: 'SendGrid API key not configured.' }
  const fromAddress = settings.smtpFrom ?? `noreply@school.com`
  const body = {
    personalizations: [{ to: [{ email: payload.to }] }],
    from: { email: fromAddress, name: settings.name ?? 'School' },
    subject: payload.subject,
    content: [
      { type: 'text/html', value: payload.html },
      ...(payload.text ? [{ type: 'text/plain', value: payload.text }] : []),
    ],
  }
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    return { success: false, error: `SendGrid error: ${err}` }
  }
  return { success: true }
}

// HTML email templates
export function welcomeEmailHtml(name: string, email: string, tempPassword: string, schoolName: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>Welcome to ${escapeHtml(schoolName)}</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your account has been created. Use the details below to log in:</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 8px;font-weight:bold">Email:</td><td style="padding:4px 8px">${escapeHtml(email)}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold">Password:</td><td style="padding:4px 8px;font-family:monospace">${tempPassword}</td></tr>
      </table>
      <p style="color:#dc2626">Please change your password after logging in.</p>
    </div>
  `
}

export function invoiceEmailHtml(
  parentName: string,
  studentName: string,
  invoiceId: string,
  totalAmountCents: number,
  dueDate: Date,
  currencySymbol: string,
  schoolName: string,
): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>${escapeHtml(schoolName)} — Fee Invoice</h2>
      <p>Hi ${escapeHtml(parentName)},</p>
      <p>A fee invoice has been generated for <strong>${escapeHtml(studentName)}</strong>.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 8px;font-weight:bold">Invoice ID:</td><td style="padding:4px 8px">${invoiceId.slice(0, 8).toUpperCase()}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold">Amount Due:</td><td style="padding:4px 8px">${currencySymbol}${centsToDecimalString(totalAmountCents)}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold">Due Date:</td><td style="padding:4px 8px">${dueDate.toLocaleDateString()}</td></tr>
      </table>
      <p>Please contact the school office to arrange payment.</p>
    </div>
  `
}

export function truancyEmailHtml(
  parentName: string,
  studentName: string,
  consecutive: number,
  totalUnexcused: number,
  schoolName: string,
): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#dc2626">${escapeHtml(schoolName)} — Attendance Alert</h2>
      <p>Hi ${escapeHtml(parentName)},</p>
      <p>We are writing to inform you that <strong>${escapeHtml(studentName)}</strong> has been flagged for poor attendance.</p>
      <ul>
        ${consecutive > 0 ? `<li>${consecutive} consecutive unexplained absences</li>` : ''}
        ${totalUnexcused > 0 ? `<li>${totalUnexcused} total unexcused absences this term</li>` : ''}
      </ul>
      <p>Please contact the school to discuss attendance as soon as possible.</p>
    </div>
  `
}

export function behaviourEmailHtml(
  parentName: string,
  studentName: string,
  date: Date,
  severity: string,
  schoolName: string,
): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>${escapeHtml(schoolName)} — Behaviour Notification</h2>
      <p>Hi ${escapeHtml(parentName)},</p>
      <p>We are contacting you regarding a behaviour incident involving <strong>${escapeHtml(studentName)}</strong> on ${date.toLocaleDateString()}.</p>
      <p>Severity: <strong>${severity}</strong></p>
      <p>Please contact the school for further details.</p>
    </div>
  `
}

export function reportCardEmailHtml(
  parentName: string,
  studentName: string,
  termName: string,
  schoolName: string,
): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>${escapeHtml(schoolName)} — Report Card Available</h2>
      <p>Hi ${escapeHtml(parentName)},</p>
      <p>The report card for <strong>${escapeHtml(studentName)}</strong> for <strong>${escapeHtml(termName)}</strong> is now available.</p>
      <p>Please log in to the parent portal to view and download the report card.</p>
    </div>
  `
}

export function feeReminderEmailHtml(
  parentName: string,
  studentName: string,
  invoiceId: string,
  outstandingCents: number,
  dueDate: Date,
  currencySymbol: string,
  schoolName: string,
): string {
  const overdueDays = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#dc2626">${escapeHtml(schoolName)} — Fee Payment Reminder</h2>
      <p>Hi ${escapeHtml(parentName)},</p>
      <p>This is a reminder that an outstanding fee invoice for <strong>${escapeHtml(studentName)}</strong> is overdue.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 8px;font-weight:bold">Invoice ID:</td><td style="padding:4px 8px">${invoiceId.slice(0, 8).toUpperCase()}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold">Outstanding:</td><td style="padding:4px 8px;color:#dc2626;font-weight:bold">${currencySymbol}${centsToDecimalString(outstandingCents)}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold">Due Date:</td><td style="padding:4px 8px">${dueDate.toLocaleDateString()}${overdueDays > 0 ? ` (${overdueDays} day${overdueDays > 1 ? 's' : ''} overdue)` : ''}</td></tr>
      </table>
      <p>Please contact the school office to arrange payment at your earliest convenience.</p>
    </div>
  `
}

export function leaveDecisionEmailHtml(
  staffName: string,
  status: string,
  leaveType: string,
  startDate: Date,
  endDate: Date,
  schoolName: string,
): string {
  const statusText = status === 'approved' ? 'approved' : 'declined'
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>${escapeHtml(schoolName)} — Leave Request ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}</h2>
      <p>Hi ${escapeHtml(staffName)},</p>
      <p>Your leave request has been <strong>${statusText}</strong>.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 8px;font-weight:bold">Type:</td><td style="padding:4px 8px">${leaveType}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold">From:</td><td style="padding:4px 8px">${startDate.toLocaleDateString()}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold">To:</td><td style="padding:4px 8px">${endDate.toLocaleDateString()}</td></tr>
      </table>
      <p>Please contact HR if you have any questions.</p>
    </div>
  `
}

/** Escapes text for safe inclusion in HTML email bodies. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function absenceEmailHtml(
  parentName: string,
  studentName: string,
  dateLabel: string,
  schoolName: string,
): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>${escapeHtml(schoolName)}: absence notice</h2>
      <p>Hi ${escapeHtml(parentName)},</p>
      <p><strong>${escapeHtml(studentName)}</strong> was marked absent from school on <strong>${escapeHtml(dateLabel)}</strong>.</p>
      <p>If this absence was expected, you do not need to reply. If you have not yet told the school why your child is away, please contact the school office.</p>
    </div>
  `
}
