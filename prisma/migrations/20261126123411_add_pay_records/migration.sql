-- CreateTable
CREATE TABLE "PayRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "payDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "paidAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PayLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payRunId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "netCents" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayLine_payRunId_fkey" FOREIGN KEY ("payRunId") REFERENCES "PayRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayLine_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PayLine_payRunId_staffId_key" ON "PayLine"("payRunId", "staffId");
