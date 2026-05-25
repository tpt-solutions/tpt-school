// SIS (Student Information System) export utilities
// Pure functions — no DB calls. All builders take plain data objects.

export type ExportStudent = {
  id: string
  studentId: string      // internal code
  nsn: string | null     // national student number
  name: string           // full name
  firstName: string
  lastName: string
  dateOfBirth: Date | null
  gender: string | null
  yearLevel: number | null
  enrollmentStatus: string
  enrollmentDate: Date
  ethnicity: string | null
  indigenousStatus: string | null
  languageBackground: string | null
  nationality: string | null
  address: string | null
}

export type ExportAttendance = {
  studentId: string
  studentNsn: string | null
  studentName: string
  date: Date
  status: string
  notes: string | null
}

// ─── CSV helper ───────────────────────────────────────────────────────────────

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function buildCsvString(rows: Record<string, string | number | null | undefined>[], headers: string[]): string {
  const lines: string[] = [headers.map(csvCell).join(',')]
  for (const row of rows) {
    lines.push(headers.map(h => csvCell(row[h])).join(','))
  }
  return lines.join('\r\n')
}

function formatDate(d: Date | null | undefined, fmt: 'yyyy-mm-dd' | 'dd/mm/yyyy' | 'mm/dd/yyyy'): string {
  if (!d) return ''
  const date = new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  if (fmt === 'yyyy-mm-dd') return `${y}-${m}-${day}`
  if (fmt === 'dd/mm/yyyy') return `${day}/${m}/${y}`
  return `${m}/${day}/${y}`
}

// ─── Universal Students CSV ───────────────────────────────────────────────────

export const UNIVERSAL_STUDENT_HEADERS = [
  'StudentID', 'NSN', 'FirstName', 'LastName', 'FullName',
  'DateOfBirth', 'Gender', 'YearLevel', 'EnrollmentStatus',
  'EnrollmentDate', 'Ethnicity', 'Nationality', 'Address',
]

export function buildUniversalStudentRow(s: ExportStudent): Record<string, string> {
  return {
    StudentID: s.studentId,
    NSN: s.nsn ?? '',
    FirstName: s.firstName,
    LastName: s.lastName,
    FullName: s.name,
    DateOfBirth: formatDate(s.dateOfBirth, 'yyyy-mm-dd'),
    Gender: s.gender ?? '',
    YearLevel: s.yearLevel != null ? String(s.yearLevel) : '',
    EnrollmentStatus: s.enrollmentStatus,
    EnrollmentDate: formatDate(s.enrollmentDate, 'yyyy-mm-dd'),
    Ethnicity: s.ethnicity ?? '',
    Nationality: s.nationality ?? '',
    Address: s.address ?? '',
  }
}

// ─── Universal Attendance CSV ─────────────────────────────────────────────────

export const UNIVERSAL_ATTENDANCE_HEADERS = [
  'StudentID', 'NSN', 'StudentName', 'Date', 'Status', 'Notes',
]

export function buildUniversalAttendanceRow(a: ExportAttendance): Record<string, string> {
  return {
    StudentID: a.studentId,
    NSN: a.studentNsn ?? '',
    StudentName: a.studentName,
    Date: formatDate(a.date, 'yyyy-mm-dd'),
    Status: a.status,
    Notes: a.notes ?? '',
  }
}

// ─── NZ MoE CSV ───────────────────────────────────────────────────────────────

const NZ_ETHNICITY_MAP: Record<string, string> = {
  'nz european': '1', 'pākehā': '1', 'pakehā': '1', 'new zealand european': '1',
  'māori': '2', 'maori': '2',
  'pacific': '3', 'pasifika': '3', 'pacific islander': '3',
  'asian': '4',
  'melaa': '5', 'middle eastern': '5', 'latin american': '5', 'african': '5',
  'other': '6',
}

function nzEthnicityCode(ethnicity: string | null): string {
  if (!ethnicity) return '9'
  const lower = ethnicity.toLowerCase().trim()
  return NZ_ETHNICITY_MAP[lower] ?? '9'
}

export const NZ_MOE_HEADERS = [
  'NSN', 'FirstName', 'LastName', 'DateOfBirth', 'Gender',
  'YearLevel', 'EthnicityCode', 'Ethnicity', 'EnrollmentDate', 'EnrollmentStatus',
]

export function buildNzMoeRow(s: ExportStudent): Record<string, string> {
  return {
    NSN: s.nsn ?? '',
    FirstName: s.firstName,
    LastName: s.lastName,
    DateOfBirth: formatDate(s.dateOfBirth, 'yyyy-mm-dd'),
    Gender: s.gender ?? '',
    YearLevel: s.yearLevel != null ? String(s.yearLevel) : '',
    EthnicityCode: nzEthnicityCode(s.ethnicity),
    Ethnicity: s.ethnicity ?? '',
    EnrollmentDate: formatDate(s.enrollmentDate, 'yyyy-mm-dd'),
    EnrollmentStatus: s.enrollmentStatus,
  }
}

// ─── UK SIMS CSV ──────────────────────────────────────────────────────────────

export const UK_SIMS_HEADERS = [
  'UPN', 'Surname', 'Forename', 'DOB', 'Gender', 'YearGroup',
  'AdmissionDate', 'Status',
]

export function buildUkSimsRow(s: ExportStudent): Record<string, string> {
  return {
    UPN: s.nsn ?? '',
    Surname: s.lastName,
    Forename: s.firstName,
    DOB: formatDate(s.dateOfBirth, 'dd/mm/yyyy'),
    Gender: s.gender ? s.gender.substring(0, 1).toUpperCase() : '',
    YearGroup: s.yearLevel != null ? String(s.yearLevel) : '',
    AdmissionDate: formatDate(s.enrollmentDate, 'dd/mm/yyyy'),
    Status: 'C',
  }
}

// ─── AU Synergetic CSV ────────────────────────────────────────────────────────

const AU_INDIGENOUS_MAP: Record<string, string> = {
  'aboriginal': '1',
  'torres strait islander': '2',
  'both': '3',
  'neither': '4',
}

function auIndigenousCode(status: string | null): string {
  if (!status) return '9'
  return AU_INDIGENOUS_MAP[status.toLowerCase().trim()] ?? '9'
}

export const AU_SYNERGETIC_HEADERS = [
  'StateStudentId', 'Surname', 'FirstName', 'DOB', 'Gender',
  'YearLevel', 'IndigenousStatus', 'LBOTE', 'EnrollmentDate', 'ActiveStatus',
]

export function buildAuSynergeticRow(s: ExportStudent): Record<string, string> {
  const lbote = s.languageBackground
    ? (s.languageBackground.toLowerCase() !== 'english' ? 'Y' : 'N')
    : 'N'
  return {
    StateStudentId: s.nsn ?? '',
    Surname: s.lastName,
    FirstName: s.firstName,
    DOB: formatDate(s.dateOfBirth, 'dd/mm/yyyy'),
    Gender: s.gender ? s.gender.substring(0, 1).toUpperCase() : '',
    YearLevel: s.yearLevel != null ? String(s.yearLevel) : '',
    IndigenousStatus: auIndigenousCode(s.indigenousStatus),
    LBOTE: lbote,
    EnrollmentDate: formatDate(s.enrollmentDate, 'dd/mm/yyyy'),
    ActiveStatus: s.enrollmentStatus === 'active' ? 'A' : 'I',
  }
}

// ─── CA PowerSchool CSV ───────────────────────────────────────────────────────

export const CA_POWERSCHOOL_HEADERS = [
  'Student_Number', 'OEN', 'PEN', 'Last_Name', 'First_Name',
  'DOB', 'Gender', 'Grade_Level', 'Enrollment_Date', 'Enroll_Status',
]

export function buildCaPowerSchoolRow(s: ExportStudent): Record<string, string> {
  return {
    Student_Number: s.nsn ?? '',
    OEN: s.nsn ?? '',
    PEN: s.nsn ?? '',
    Last_Name: s.lastName,
    First_Name: s.firstName,
    DOB: formatDate(s.dateOfBirth, 'mm/dd/yyyy'),
    Gender: s.gender ? s.gender.substring(0, 1).toUpperCase() : '',
    Grade_Level: s.yearLevel != null ? String(s.yearLevel) : '',
    Enrollment_Date: formatDate(s.enrollmentDate, 'mm/dd/yyyy'),
    Enroll_Status: s.enrollmentStatus === 'active' ? '0' : '-1',
  }
}

// ─── Ed-Fi JSON ───────────────────────────────────────────────────────────────

export type EdFiExport = {
  students: EdFiStudent[]
  enrollments: EdFiEnrollment[]
  attendanceEvents: EdFiAttendanceEvent[]
}

type EdFiStudent = {
  studentUniqueId: string
  firstName: string
  lastSurname: string
  birthDate: string
  sexDescriptor: string
}

type EdFiEnrollment = {
  studentReference: { studentUniqueId: string }
  schoolReference: { schoolId: string }
  entryDate: string
  entryGradeLevelDescriptor: string
  enrollmentTypeDescriptor: string
}

type EdFiAttendanceEvent = {
  studentReference: { studentUniqueId: string }
  schoolReference: { schoolId: string }
  eventDate: string
  attendanceEventCategoryDescriptor: string
  attendanceEventReason?: string
}

const EDFI_SEX_MAP: Record<string, string> = {
  male: 'uri://ed-fi.org/SexDescriptor#Male',
  female: 'uri://ed-fi.org/SexDescriptor#Female',
}

const EDFI_STATUS_MAP: Record<string, string> = {
  present: 'uri://ed-fi.org/AttendanceEventCategoryDescriptor#In Attendance',
  absent: 'uri://ed-fi.org/AttendanceEventCategoryDescriptor#Unexcused Absence',
  late: 'uri://ed-fi.org/AttendanceEventCategoryDescriptor#Tardy',
  excused: 'uri://ed-fi.org/AttendanceEventCategoryDescriptor#Excused Absence',
}

const EDFI_GRADE_MAP: Record<number, string> = {
  0: 'uri://ed-fi.org/GradeLevelDescriptor#Kindergarten',
  1: 'uri://ed-fi.org/GradeLevelDescriptor#First grade',
  2: 'uri://ed-fi.org/GradeLevelDescriptor#Second grade',
  3: 'uri://ed-fi.org/GradeLevelDescriptor#Third grade',
  4: 'uri://ed-fi.org/GradeLevelDescriptor#Fourth grade',
  5: 'uri://ed-fi.org/GradeLevelDescriptor#Fifth grade',
  6: 'uri://ed-fi.org/GradeLevelDescriptor#Sixth grade',
  7: 'uri://ed-fi.org/GradeLevelDescriptor#Seventh grade',
  8: 'uri://ed-fi.org/GradeLevelDescriptor#Eighth grade',
  9: 'uri://ed-fi.org/GradeLevelDescriptor#Ninth grade',
  10: 'uri://ed-fi.org/GradeLevelDescriptor#Tenth grade',
  11: 'uri://ed-fi.org/GradeLevelDescriptor#Eleventh grade',
  12: 'uri://ed-fi.org/GradeLevelDescriptor#Twelfth grade',
}

export function buildEdFiExport(
  students: ExportStudent[],
  attendanceRecords: ExportAttendance[],
  schoolId = 'school-1',
): EdFiExport {
  return {
    students: students.map(s => ({
      studentUniqueId: s.nsn ?? s.studentId,
      firstName: s.firstName,
      lastSurname: s.lastName,
      birthDate: formatDate(s.dateOfBirth, 'yyyy-mm-dd'),
      sexDescriptor: EDFI_SEX_MAP[s.gender?.toLowerCase() ?? ''] ?? 'uri://ed-fi.org/SexDescriptor#Not Selected',
    })),
    enrollments: students.map(s => ({
      studentReference: { studentUniqueId: s.nsn ?? s.studentId },
      schoolReference: { schoolId },
      entryDate: formatDate(s.enrollmentDate, 'yyyy-mm-dd'),
      entryGradeLevelDescriptor: s.yearLevel != null ? (EDFI_GRADE_MAP[s.yearLevel] ?? `uri://ed-fi.org/GradeLevelDescriptor#${s.yearLevel}`) : '',
      enrollmentTypeDescriptor: 'uri://ed-fi.org/EnrollmentTypeDescriptor#New',
    })),
    attendanceEvents: attendanceRecords.map(a => ({
      studentReference: { studentUniqueId: a.studentNsn ?? a.studentId },
      schoolReference: { schoolId },
      eventDate: formatDate(a.date, 'yyyy-mm-dd'),
      attendanceEventCategoryDescriptor: EDFI_STATUS_MAP[a.status] ?? EDFI_STATUS_MAP.present,
      ...(a.notes ? { attendanceEventReason: a.notes } : {}),
    })),
  }
}
