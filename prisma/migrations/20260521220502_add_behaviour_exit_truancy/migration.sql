-- CreateTable
CREATE TABLE "StudentExit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "exitType" TEXT NOT NULL,
    "exitDate" DATETIME NOT NULL,
    "reason" TEXT,
    "destinationSchool" TEXT,
    "authorisedBy" TEXT,
    "notes" TEXT,
    "documentsIssued" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentExit_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BehaviourIncident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'minor',
    "witnesses" TEXT,
    "parentNotified" BOOLEAN NOT NULL DEFAULT false,
    "parentNotifiedAt" DATETIME,
    "actionTaken" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BehaviourIncident_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Suspension" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "incidentId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'out-of-school',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "returnConditions" TEXT,
    "authorisedBy" TEXT,
    "parentNotified" BOOLEAN NOT NULL DEFAULT false,
    "parentMeetingDate" DATETIME,
    "returnDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Suspension_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Suspension_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "BehaviourIncident" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TruancyAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "consecutiveAbsences" INTEGER NOT NULL,
    "totalUnexcused" INTEGER NOT NULL,
    "alertDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "notes" TEXT,
    CONSTRAINT "TruancyAlert_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentExit_studentId_key" ON "StudentExit"("studentId");
