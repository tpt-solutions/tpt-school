/*
  Warnings:

  - Added the required column `threadId` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Student" ADD COLUMN "indigenousStatus" TEXT;
ALTER TABLE "Student" ADD COLUMN "languageBackground" TEXT;
ALTER TABLE "Student" ADD COLUMN "nsn" TEXT;

-- CreateTable
CREATE TABLE "AttendanceCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "termId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "windowMins" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AttendanceCodeUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceCodeUsage_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "AttendanceCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "parentId" TEXT,
    "threadId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("body", "createdAt", "id", "senderId", "subject") SELECT "body", "createdAt", "id", "senderId", "subject" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE INDEX "Message_threadId_idx" ON "Message"("threadId");
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
    "parentMessagingDefault" BOOLEAN NOT NULL DEFAULT true,
    "lastSessionCleanup" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SchoolSettings" ("address", "aiApiKey", "aiBaseUrl", "aiModel", "aiProvider", "aiReportMode", "createdAt", "currencyCode", "currencySymbol", "currentTerm", "currentYear", "email", "emailProvider", "id", "lastSessionCleanup", "logo", "mailjetApiKey", "mailjetSecret", "name", "phone", "resendApiKey", "schoolType", "sendgridApiKey", "setupComplete", "shortName", "smtpFrom", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "timezone", "updatedAt", "website") SELECT "address", "aiApiKey", "aiBaseUrl", "aiModel", "aiProvider", "aiReportMode", "createdAt", "currencyCode", "currencySymbol", "currentTerm", "currentYear", "email", "emailProvider", "id", "lastSessionCleanup", "logo", "mailjetApiKey", "mailjetSecret", "name", "phone", "resendApiKey", "schoolType", "sendgridApiKey", "setupComplete", "shortName", "smtpFrom", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "timezone", "updatedAt", "website" FROM "SchoolSettings";
DROP TABLE "SchoolSettings";
ALTER TABLE "new_SchoolSettings" RENAME TO "SchoolSettings";
CREATE TABLE "new_Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "dateHired" DATETIME,
    "dateLeft" DATETIME,
    "employmentType" TEXT NOT NULL DEFAULT 'full-time',
    "bio" TEXT,
    "qualifications" TEXT,
    "allowParentReplies" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Staff" ("bio", "dateHired", "dateLeft", "department", "employeeId", "employmentType", "id", "jobTitle", "qualifications", "userId") SELECT "bio", "dateHired", "dateLeft", "department", "employeeId", "employmentType", "id", "jobTitle", "qualifications", "userId" FROM "Staff";
DROP TABLE "Staff";
ALTER TABLE "new_Staff" RENAME TO "Staff";
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");
CREATE UNIQUE INDEX "Staff_employeeId_key" ON "Staff"("employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceCode_code_key" ON "AttendanceCode"("code");

-- CreateIndex
CREATE INDEX "AttendanceCode_code_idx" ON "AttendanceCode"("code");

-- CreateIndex
CREATE INDEX "AttendanceCode_classId_date_idx" ON "AttendanceCode"("classId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceCodeUsage_codeId_studentId_key" ON "AttendanceCodeUsage"("codeId", "studentId");
