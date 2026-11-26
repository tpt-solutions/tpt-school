-- Money stored as integer cents (was REAL dollars).
-- Each amount is converted with ROUND(x * 100) before the float column is dropped.

-- FeeType.amount -> amountCents
ALTER TABLE "FeeType" ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "FeeType" SET "amountCents" = CAST(ROUND("amount" * 100) AS INTEGER);
ALTER TABLE "FeeType" DROP COLUMN "amount";

-- FeeInvoice.totalAmount / paidAmount -> totalAmountCents / paidAmountCents
ALTER TABLE "FeeInvoice" ADD COLUMN "totalAmountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FeeInvoice" ADD COLUMN "paidAmountCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "FeeInvoice" SET
  "totalAmountCents" = CAST(ROUND("totalAmount" * 100) AS INTEGER),
  "paidAmountCents" = CAST(ROUND(COALESCE("paidAmount", 0) * 100) AS INTEGER);
ALTER TABLE "FeeInvoice" DROP COLUMN "totalAmount";
ALTER TABLE "FeeInvoice" DROP COLUMN "paidAmount";

-- FeeInvoiceItem.amount -> amountCents
ALTER TABLE "FeeInvoiceItem" ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "FeeInvoiceItem" SET "amountCents" = CAST(ROUND("amount" * 100) AS INTEGER);
ALTER TABLE "FeeInvoiceItem" DROP COLUMN "amount";

-- FeePayment.amount -> amountCents
ALTER TABLE "FeePayment" ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "FeePayment" SET "amountCents" = CAST(ROUND("amount" * 100) AS INTEGER);
ALTER TABLE "FeePayment" DROP COLUMN "amount";
