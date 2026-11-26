import 'dotenv/config'
import bcrypt from 'bcryptjs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const ADMIN_EMAIL = 'admin@school.ac.nz'
// Generated per run so no fixed password is kept in source control.
// The values are printed once, when the accounts are created.
const ADMIN_PASSWORD = randomBytes(12).toString('base64url')
const DEMO_PASSWORD = randomBytes(9).toString('base64url')

function createDb(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db'
  const dbPath = dbUrl.replace(/^file:/, '')
  const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath)
  const adapter = new PrismaBetterSqlite3({ url: resolvedPath })
  return new (PrismaClient as any)({ adapter }) as PrismaClient
}

async function main() {
  const db = createDb()

  try {
    // ── School settings ──────────────────────────────────────────────────────
    const settings = await db.schoolSettings.findFirst()
    if (!settings) {
      await db.schoolSettings.create({
        data: {
          name: 'TPT School',
          shortName: 'TPT',
          schoolType: 'both',
          currentYear: new Date().getFullYear(),
          setupComplete: true,
        },
      })
      console.log('Created default school settings.')
    } else if (!settings.setupComplete) {
      await db.schoolSettings.update({
        where: { id: settings.id },
        data: { setupComplete: true },
      })
      console.log('Marked setup as complete.')
    }

    // ── Admin user ───────────────────────────────────────────────────────────
    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
    const adminExists = await db.user.findUnique({ where: { email: ADMIN_EMAIL } })
    if (!adminExists) {
      await db.user.create({
        data: { email: ADMIN_EMAIL, passwordHash: adminHash, name: 'Administrator', role: 'admin', active: true },
      })
      console.log(`\nAdmin account created:  ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD}`)
      console.log('Change this password after first login!\n')
    }

    // ── Academic year 2025 ───────────────────────────────────────────────────
    let academicYear = await db.academicYear.findFirst({ where: { year: 2025 } })
    if (!academicYear) {
      const yearStart = new Date('2025-01-28')
      const yearEnd = new Date('2025-12-05')
      const termMs = (yearEnd.getTime() - yearStart.getTime()) / 4
      academicYear = await db.academicYear.create({
        data: {
          year: 2025,
          startDate: yearStart,
          endDate: yearEnd,
          active: true,
          terms: {
            create: [
              { termNumber: 1, name: 'Term 1', startDate: new Date('2025-01-28'), endDate: new Date('2025-04-11') },
              { termNumber: 2, name: 'Term 2', startDate: new Date('2025-04-28'), endDate: new Date('2025-07-04') },
              { termNumber: 3, name: 'Term 3', startDate: new Date('2025-07-21'), endDate: new Date('2025-09-26') },
              { termNumber: 4, name: 'Term 4', startDate: new Date('2025-10-13'), endDate: new Date('2025-12-05') },
            ],
          },
        },
      })
      console.log('Created academic year 2025 with 4 terms.')
    } else if (!academicYear.active) {
      await db.academicYear.update({ where: { id: academicYear.id }, data: { active: true } })
    }

    // ── Demo staff ───────────────────────────────────────────────────────────
    const demoHash = await bcrypt.hash(DEMO_PASSWORD, 12)

    const staffData = [
      { email: 'sarah.johnson@tptschool.ac.nz', name: 'Sarah Johnson', jobTitle: 'Head of Mathematics', department: 'Mathematics', employmentType: 'full-time', dateHired: new Date('2019-01-28') },
      { email: 'james.wilson@tptschool.ac.nz', name: 'James Wilson', jobTitle: 'Science Teacher', department: 'Science', employmentType: 'full-time', dateHired: new Date('2021-01-25') },
      { email: 'emily.chen@tptschool.ac.nz', name: 'Emily Chen', jobTitle: 'English Teacher', department: 'English', employmentType: 'part-time', dateHired: new Date('2022-01-31') },
    ]

    const staffCount = await db.staff.count()
    const staffIds: string[] = []

    for (const s of staffData) {
      const existingUser = await db.user.findUnique({ where: { email: s.email }, include: { staffProfile: true } })
      if (existingUser?.staffProfile) {
        staffIds.push(existingUser.staffProfile.id)
        continue
      }
      const count = await db.staff.count()
      const user = await db.user.create({
        data: { email: s.email, passwordHash: demoHash, name: s.name, role: 'teacher', active: true },
      })
      const staff = await db.staff.create({
        data: {
          userId: user.id,
          employeeId: `EMP-${String(count + 1).padStart(4, '0')}`,
          jobTitle: s.jobTitle,
          department: s.department,
          employmentType: s.employmentType,
          dateHired: s.dateHired,
        },
      })
      staffIds.push(staff.id)
    }

    if (staffCount === 0) {
      console.log(`Created 3 demo staff (password: ${DEMO_PASSWORD})`)
    }

    // ── Demo students ────────────────────────────────────────────────────────
    const studentData = [
      { email: 'aisha.patel@student.tptschool.ac.nz', name: 'Aisha Patel', yearLevel: 9, gender: 'female', dob: new Date('2010-03-15'), nationality: 'New Zealand', emergencyName: 'Priya Patel', emergencyPhone: '021 555 0101', emergencyRelation: 'Mother' },
      { email: 'lucas.fernandez@student.tptschool.ac.nz', name: 'Lucas Fernandez', yearLevel: 10, gender: 'male', dob: new Date('2009-07-22'), nationality: 'New Zealand', emergencyName: 'Maria Fernandez', emergencyPhone: '021 555 0202', emergencyRelation: 'Mother' },
      { email: 'mia.thompson@student.tptschool.ac.nz', name: 'Mia Thompson', yearLevel: 9, gender: 'female', dob: new Date('2010-11-08'), nationality: 'New Zealand', emergencyName: 'David Thompson', emergencyPhone: '021 555 0303', emergencyRelation: 'Father' },
    ]

    const studentCount = await db.student.count()
    const studentIds: string[] = []

    for (const s of studentData) {
      const existingUser = await db.user.findUnique({ where: { email: s.email }, include: { studentProfile: true } })
      if (existingUser?.studentProfile) {
        studentIds.push(existingUser.studentProfile.id)
        continue
      }
      const count = await db.student.count()
      const user = await db.user.create({
        data: { email: s.email, passwordHash: demoHash, name: s.name, role: 'student', active: true },
      })
      const student = await db.student.create({
        data: {
          userId: user.id,
          studentId: `STU-${String(count + 1).padStart(5, '0')}`,
          yearLevel: s.yearLevel,
          gender: s.gender,
          dateOfBirth: s.dob,
          nationality: s.nationality,
          enrollmentStatus: 'active',
          enrollmentDate: new Date('2025-01-28'),
          emergencyName: s.emergencyName,
          emergencyPhone: s.emergencyPhone,
          emergencyRelation: s.emergencyRelation,
        },
      })
      studentIds.push(student.id)
    }

    if (studentCount === 0) {
      console.log(`Created 3 demo students (password: ${DEMO_PASSWORD})`)
    }

    // ── Demo classes ─────────────────────────────────────────────────────────
    const classData = [
      { name: 'Mathematics 9A', code: 'MATH9A', subject: 'Mathematics', yearLevel: 9, staffIdx: 0 },
      { name: 'Science 10B', code: 'SCI10B', subject: 'Science', yearLevel: 10, staffIdx: 1 },
      { name: 'English 9A', code: 'ENG9A', subject: 'English', yearLevel: 9, staffIdx: 2 },
    ]

    const classCount = await db.class.count()
    const classIds: string[] = []

    for (const c of classData) {
      const existing = await db.class.findFirst({ where: { academicYearId: academicYear.id, code: c.code } })
      if (existing) {
        classIds.push(existing.id)
        continue
      }
      const cls = await db.class.create({
        data: {
          academicYearId: academicYear.id,
          name: c.name,
          code: c.code,
          subject: c.subject,
          yearLevel: c.yearLevel,
          maxStudents: 30,
        },
      })
      classIds.push(cls.id)

      // Link teacher if we have a staff ID
      const staffId = staffIds[c.staffIdx]
      if (staffId) {
        const alreadyLinked = await db.classTeacher.findUnique({
          where: { classId_staffId: { classId: cls.id, staffId } },
        })
        if (!alreadyLinked) {
          await db.classTeacher.create({ data: { classId: cls.id, staffId, isPrimary: true } })
        }
      }
    }

    if (classCount === 0) {
      console.log('Created 3 demo classes.')
    }

    // ── Enrol students in classes ────────────────────────────────────────────
    // Aisha (Y9) → MATH9A, ENG9A | Lucas (Y10) → SCI10B | Mia (Y9) → MATH9A, ENG9A
    const enrolments = [
      { studentIdx: 0, classIdx: 0 }, // Aisha → Math 9A
      { studentIdx: 0, classIdx: 2 }, // Aisha → English 9A
      { studentIdx: 1, classIdx: 1 }, // Lucas → Science 10B
      { studentIdx: 2, classIdx: 0 }, // Mia → Math 9A
      { studentIdx: 2, classIdx: 2 }, // Mia → English 9A
    ]

    for (const e of enrolments) {
      const studentId = studentIds[e.studentIdx]
      const classId = classIds[e.classIdx]
      if (!studentId || !classId) continue
      const exists = await db.classEnrolment.findUnique({ where: { classId_studentId: { classId, studentId } } })
      if (!exists) {
        await db.classEnrolment.create({ data: { classId, studentId, status: 'active', enrolledAt: new Date('2025-01-28') } })
      }
    }

    // ── Demo rooms ───────────────────────────────────────────────────────────
    const roomCount = await db.room.count()
    if (roomCount === 0) {
      await db.room.createMany({
        data: [
          { name: 'Room 101', code: 'R101', capacity: 30, type: 'classroom', building: 'A', floor: '1' },
          { name: 'Room 102', code: 'R102', capacity: 30, type: 'classroom', building: 'A', floor: '1' },
          { name: 'Room 201', code: 'R201', capacity: 28, type: 'classroom', building: 'A', floor: '2' },
          { name: 'Science Lab 1', code: 'SCI1', capacity: 24, type: 'lab', building: 'B', floor: '1' },
          { name: 'Science Lab 2', code: 'SCI2', capacity: 24, type: 'lab', building: 'B', floor: '1' },
          { name: 'Computer Suite', code: 'CS1', capacity: 32, type: 'computer', building: 'B', floor: '2' },
          { name: 'Gymnasium', code: 'GYM', capacity: 100, type: 'gym', building: 'C', floor: '1' },
          { name: 'Library', code: 'LIB', capacity: 60, type: 'library', building: 'A', floor: '1' },
        ],
      })
      console.log('Created 8 demo rooms.')
    }

    console.log('\nSeed complete.')
  } finally {
    await db.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
