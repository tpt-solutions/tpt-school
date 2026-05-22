-- CreateTable
CREATE TABLE "StudentTransferIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "previousSchool" TEXT NOT NULL,
    "previousYearLevel" INTEGER,
    "transferDate" DATETIME NOT NULL,
    "reason" TEXT,
    "documentsReceived" BOOLEAN NOT NULL DEFAULT false,
    "academicRecordsNotes" TEXT,
    "notes" TEXT,
    "processedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentTransferIn_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentTransferIn_studentId_key" ON "StudentTransferIn"("studentId");
