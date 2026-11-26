-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FeeInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "notes" TEXT,
    "totalAmountCents" INTEGER NOT NULL,
    "paidAmountCents" INTEGER NOT NULL DEFAULT 0,
    "lastReminderSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeeInvoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FeeInvoice" ("createdAt", "dueDate", "id", "issueDate", "lastReminderSentAt", "notes", "paidAmountCents", "status", "studentId", "totalAmountCents", "updatedAt") SELECT "createdAt", "dueDate", "id", "issueDate", "lastReminderSentAt", "notes", "paidAmountCents", "status", "studentId", "totalAmountCents", "updatedAt" FROM "FeeInvoice";
DROP TABLE "FeeInvoice";
ALTER TABLE "new_FeeInvoice" RENAME TO "FeeInvoice";
CREATE INDEX "FeeInvoice_studentId_idx" ON "FeeInvoice"("studentId");
CREATE INDEX "FeeInvoice_status_idx" ON "FeeInvoice"("status");
CREATE TABLE "new_FeeInvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "feeTypeId" TEXT,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    CONSTRAINT "FeeInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FeeInvoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FeeInvoiceItem_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "FeeType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FeeInvoiceItem" ("amountCents", "description", "feeTypeId", "id", "invoiceId") SELECT "amountCents", "description", "feeTypeId", "id", "invoiceId" FROM "FeeInvoiceItem";
DROP TABLE "FeeInvoiceItem";
ALTER TABLE "new_FeeInvoiceItem" RENAME TO "FeeInvoiceItem";
CREATE TABLE "new_FeePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'cash',
    "reference" TEXT,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT,
    "notes" TEXT,
    CONSTRAINT "FeePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FeeInvoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FeePayment" ("amountCents", "id", "invoiceId", "method", "notes", "paidAt", "recordedBy", "reference") SELECT "amountCents", "id", "invoiceId", "method", "notes", "paidAt", "recordedBy", "reference" FROM "FeePayment";
DROP TABLE "FeePayment";
ALTER TABLE "new_FeePayment" RENAME TO "FeePayment";
CREATE INDEX "FeePayment_invoiceId_idx" ON "FeePayment"("invoiceId");
CREATE TABLE "new_FeeType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'annual',
    "yearLevel" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_FeeType" ("active", "amountCents", "description", "frequency", "id", "name", "yearLevel") SELECT "active", "amountCents", "description", "frequency", "id", "name", "yearLevel" FROM "FeeType";
DROP TABLE "FeeType";
ALTER TABLE "new_FeeType" RENAME TO "FeeType";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
