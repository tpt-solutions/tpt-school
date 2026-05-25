-- CreateTable
CREATE TABLE "TimetableRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classId" TEXT NOT NULL,
    "staffId" TEXT,
    "preferredRoomId" TEXT,
    "periodsPerWeek" INTEGER NOT NULL,
    "label" TEXT,
    CONSTRAINT "TimetableRequirement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimetableRequirement_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimetableRequirement_preferredRoomId_fkey" FOREIGN KEY ("preferredRoomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Class" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "subject" TEXT,
    "yearLevel" INTEGER,
    "roomId" TEXT,
    "maxStudents" INTEGER,
    "description" TEXT,
    "periodsPerWeek" INTEGER NOT NULL DEFAULT 5,
    CONSTRAINT "Class_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Class_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Class" ("academicYearId", "code", "description", "id", "maxStudents", "name", "roomId", "subject", "yearLevel") SELECT "academicYearId", "code", "description", "id", "maxStudents", "name", "roomId", "subject", "yearLevel" FROM "Class";
DROP TABLE "Class";
ALTER TABLE "new_Class" RENAME TO "Class";
CREATE UNIQUE INDEX "Class_academicYearId_code_key" ON "Class"("academicYearId", "code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TimetableRequirement_classId_staffId_key" ON "TimetableRequirement"("classId", "staffId");
