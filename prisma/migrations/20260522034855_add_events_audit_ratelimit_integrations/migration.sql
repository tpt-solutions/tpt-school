-- CreateTable
CREATE TABLE "SchoolEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT NOT NULL DEFAULT 'academic',
    "targetRoles" TEXT NOT NULL DEFAULT 'all',
    "targetYears" TEXT NOT NULL DEFAULT 'all',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SchoolSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "currencySymbol" TEXT NOT NULL DEFAULT '$',
    "schoolType" TEXT NOT NULL DEFAULT 'both',
    "currentYear" INTEGER NOT NULL,
    "currentTerm" INTEGER NOT NULL DEFAULT 1,
    "setupComplete" BOOLEAN NOT NULL DEFAULT false,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpFrom" TEXT,
    "emailProvider" TEXT NOT NULL DEFAULT 'smtp',
    "resendApiKey" TEXT,
    "mailjetApiKey" TEXT,
    "mailjetSecret" TEXT,
    "sendgridApiKey" TEXT,
    "aiProvider" TEXT NOT NULL DEFAULT 'none',
    "aiApiKey" TEXT,
    "aiModel" TEXT,
    "aiBaseUrl" TEXT,
    "aiReportMode" TEXT NOT NULL DEFAULT 'assist',
    "lastSessionCleanup" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SchoolSettings" ("address", "createdAt", "currencyCode", "currencySymbol", "currentTerm", "currentYear", "email", "id", "logo", "name", "phone", "schoolType", "setupComplete", "shortName", "smtpFrom", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "timezone", "updatedAt", "website") SELECT "address", "createdAt", "currencyCode", "currencySymbol", "currentTerm", "currentYear", "email", "id", "logo", "name", "phone", "schoolType", "setupComplete", "shortName", "smtpFrom", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "timezone", "updatedAt", "website" FROM "SchoolSettings";
DROP TABLE "SchoolSettings";
ALTER TABLE "new_SchoolSettings" RENAME TO "SchoolSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_createdAt_idx" ON "AuditLog"("entityType", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_ip_createdAt_idx" ON "LoginAttempt"("ip", "createdAt");
