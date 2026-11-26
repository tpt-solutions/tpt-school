-- Billing key on invoice items created by "generate term fees", so one fee is never billed twice for a period.
ALTER TABLE "FeeInvoiceItem" ADD COLUMN "billingKey" TEXT;

CREATE INDEX "FeeInvoiceItem_billingKey_idx" ON "FeeInvoiceItem"("billingKey");
