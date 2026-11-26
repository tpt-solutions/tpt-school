import "server-only";

import Stripe from "stripe";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { linkedStudentsFor } from "@/lib/portal";

/**
 * Online card payments through Stripe Checkout. Disabled unless both keys are set, so a school
 * that does not use it sees no change. Money is recorded only from a verified webhook, never
 * from the browser redirect, and each Stripe session can be recorded at most once.
 */

export function paymentsEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Online payments are not configured.");
  return new Stripe(key);
}

function currency(): string {
  return (process.env.STRIPE_CURRENCY ?? "nzd").toLowerCase();
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Creates a hosted Checkout session for the outstanding balance of one invoice.
 * Only a parent linked to the child on the invoice can start a payment.
 */
export async function createInvoiceCheckout(
  user: SessionUser,
  invoiceId: string,
): Promise<{ url: string } | { error: string }> {
  if (!paymentsEnabled()) return { error: "Online payments are not set up for this school." };
  if (user.role !== "parent") return { error: "Only parents can pay invoices online." };

  const invoice = await db.feeInvoice.findUnique({
    where: { id: invoiceId },
    include: { student: { select: { id: true, user: { select: { name: true } } } } },
  });
  if (!invoice) return { error: "Invoice not found." };

  const children = await linkedStudentsFor(user);
  if (!children.some((c) => c.id === invoice.studentId)) return { error: "Invoice not found." };

  const outstanding = invoice.totalAmountCents - invoice.paidAmountCents;
  if (outstanding <= 0) return { error: "This invoice has no balance to pay." };

  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: currency(),
          unit_amount: outstanding,
          product_data: { name: `School fees for ${invoice.student.user.name}` },
        },
      },
    ],
    client_reference_id: invoice.id,
    // payerUserId lets the webhook attribute its audit entry to a real user (AuditLog.userId is a foreign key)
    metadata: { invoiceId: invoice.id, payerUserId: user.id },
    success_url: `${baseUrl()}/portal/invoices?payment=success`,
    cancel_url: `${baseUrl()}/portal/invoices?payment=cancelled`,
  });

  if (!session.url) return { error: "Could not start the payment. Please try again." };
  await logAudit(user.id, "CREATE", "FeeInvoice", `Started online payment of ${outstanding} cents`, invoice.id);
  return { url: session.url };
}

/**
 * Records a completed Checkout session. Idempotent: Stripe may deliver the same event more than
 * once, and the session id is stored as the payment reference, so a repeat is a no-op.
 */
export async function recordCompletedCheckout(session: Stripe.Checkout.Session): Promise<"recorded" | "duplicate" | "ignored"> {
  const invoiceId = session.metadata?.invoiceId ?? session.client_reference_id ?? null;
  const amountCents = session.amount_total ?? 0;
  if (!invoiceId || amountCents <= 0 || session.payment_status !== "paid") return "ignored";

  const outcome = await db.$transaction(async (tx) => {
    const already = await tx.feePayment.findFirst({ where: { reference: session.id }, select: { id: true } });
    if (already) return "duplicate" as const;

    const invoice = await tx.feeInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return "ignored" as const;

    const newPaid = invoice.paidAmountCents + amountCents;
    const overpaid = newPaid > invoice.totalAmountCents;
    const status = newPaid >= invoice.totalAmountCents ? "paid" : "partial";

    await tx.feeInvoice.update({
      where: { id: invoiceId },
      data: { paidAmountCents: newPaid, status },
    });
    await tx.feePayment.create({
      data: {
        invoiceId,
        amountCents,
        method: "online",
        reference: session.id,
        notes: overpaid ? "Paid online. This exceeds the balance: a refund may be due." : "Paid online by card.",
      },
    });
    return overpaid ? ("overpaid" as const) : ("recorded" as const);
  });

  const payerUserId = session.metadata?.payerUserId;
  if ((outcome === "recorded" || outcome === "overpaid") && payerUserId) {
    await logAudit(
      payerUserId,
      "CREATE",
      "FeePayment",
      outcome === "overpaid"
        ? `Online payment of ${amountCents} cents exceeds the invoice balance. Check whether a refund is due.`
        : `Online payment of ${amountCents} cents recorded`,
      invoiceId,
    );
  }
  return outcome === "overpaid" ? "recorded" : outcome;
}

/** Verifies the Stripe signature on a webhook request and returns the parsed event, or null. */
export function verifyWebhook(rawBody: string, signature: string | null): Stripe.Event | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return null;
  try {
    return stripeClient().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return null;
  }
}
