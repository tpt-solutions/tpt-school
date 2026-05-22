import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer'

// Built-in PDF fonts are registered automatically; no external font load needed

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1e293b',
    backgroundColor: '#ffffff',
    padding: 40,
  },
  // Header
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
    paddingBottom: 12,
    marginBottom: 16,
  },
  schoolName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
  },
  schoolMeta: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
  },
  reportTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
  },
  // Student info row
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  infoBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoLabel: {
    fontSize: 7,
    color: '#94a3b8',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  // Section headers
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    marginBottom: 6,
    marginTop: 12,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
  },
  // Attendance
  attRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  attCard: {
    flex: 1,
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
  },
  attCardBlue: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  attCardGreen: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  attCardRed: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  attCardAmber: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' },
  attNumber: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  attNumberBlue: { color: '#1d4ed8' },
  attNumberGreen: { color: '#16a34a' },
  attNumberRed: { color: '#dc2626' },
  attNumberAmber: { color: '#d97706' },
  attLabel: { fontSize: 7, color: '#64748b', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
  // Class table
  classCard: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: '6 10',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  className: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  classTeacher: {
    fontSize: 8,
    color: '#64748b',
  },
  classAvg: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1d4ed8',
  },
  gradeTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    padding: '4 10',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  gradeRow: {
    flexDirection: 'row',
    padding: '4 10',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  gradeRowLast: {
    flexDirection: 'row',
    padding: '4 10',
  },
  colName: { flex: 3, fontSize: 9, color: '#334155' },
  colType: { flex: 1.5, fontSize: 9, color: '#64748b', textAlign: 'center' },
  colScore: { flex: 1, fontSize: 9, textAlign: 'center' },
  colGrade: { flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  colHeaderText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3 },
  noGrades: {
    fontSize: 9,
    color: '#94a3b8',
    padding: '8 10',
    textAlign: 'center',
  },
  // Footer
  footer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#94a3b8',
  },
})

type GradebookRow = {
  name: string
  type: string
  maxScore: number
  score: number | null
  letterGrade: string | null
  comment: string | null
}

type ClassSummary = {
  className: string
  classCode: string
  subject: string | null
  teacher: string | null
  gradebooks: GradebookRow[]
  avg: number | null
}

type Props = {
  student: {
    name: string
    studentId: string
    yearLevel: number | null
    email: string
  }
  school: {
    name: string
    shortName?: string
    address?: string
    phone?: string
  }
  attendance: {
    total: number
    present: number
    absent: number
    late: number
    rate: number | null
  }
  classSummaries: ClassSummary[]
  generatedAt: string
}

function scoreColor(score: number | null, max: number): string {
  if (score === null) return '#64748b'
  const pct = (score / max) * 100
  if (pct >= 80) return '#16a34a'
  if (pct >= 60) return '#d97706'
  return '#dc2626'
}

export function ReportCardDocument({ student, school, attendance, classSummaries, generatedAt }: Props) {
  return (
    <Document title={`Report Card — ${student.name}`} author={school.name}>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.schoolName}>{school.name}</Text>
          {(school.address || school.phone) && (
            <Text style={styles.schoolMeta}>
              {[school.address, school.phone].filter(Boolean).join(' · ')}
            </Text>
          )}
          <Text style={styles.reportTitle}>Student Report Card</Text>
        </View>

        {/* Student Info */}
        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Student Name</Text>
            <Text style={styles.infoValue}>{student.name}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Student ID</Text>
            <Text style={styles.infoValue}>{student.studentId}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Year Level</Text>
            <Text style={styles.infoValue}>{student.yearLevel ? `Year ${student.yearLevel}` : '—'}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Date Issued</Text>
            <Text style={styles.infoValue}>{generatedAt}</Text>
          </View>
        </View>

        {/* Attendance */}
        <Text style={styles.sectionTitle}>Attendance Summary</Text>
        <View style={styles.attRow}>
          <View style={[styles.attCard, styles.attCardBlue]}>
            <Text style={styles.attLabel}>Rate</Text>
            <Text style={[styles.attNumber, styles.attNumberBlue]}>
              {attendance.rate !== null ? `${attendance.rate}%` : '—'}
            </Text>
          </View>
          <View style={[styles.attCard, styles.attCardGreen]}>
            <Text style={styles.attLabel}>Present</Text>
            <Text style={[styles.attNumber, styles.attNumberGreen]}>{attendance.present}</Text>
          </View>
          <View style={[styles.attCard, styles.attCardRed]}>
            <Text style={styles.attLabel}>Absent</Text>
            <Text style={[styles.attNumber, styles.attNumberRed]}>{attendance.absent}</Text>
          </View>
          <View style={[styles.attCard, styles.attCardAmber]}>
            <Text style={styles.attLabel}>Late</Text>
            <Text style={[styles.attNumber, styles.attNumberAmber]}>{attendance.late}</Text>
          </View>
        </View>

        {/* Academic Results */}
        <Text style={styles.sectionTitle}>Academic Results</Text>
        {classSummaries.length === 0 ? (
          <Text style={{ fontSize: 9, color: '#94a3b8' }}>No classes enrolled.</Text>
        ) : (
          classSummaries.map((cls, i) => (
            <View key={i} style={styles.classCard} wrap={false}>
              <View style={styles.classHeader}>
                <View>
                  <Text style={styles.className}>
                    {cls.className} ({cls.classCode}){cls.subject ? ` — ${cls.subject}` : ''}
                  </Text>
                  {cls.teacher && (
                    <Text style={styles.classTeacher}>Teacher: {cls.teacher}</Text>
                  )}
                </View>
                {cls.avg !== null && (
                  <Text style={styles.classAvg}>Avg: {cls.avg}%</Text>
                )}
              </View>

              {cls.gradebooks.length === 0 ? (
                <Text style={styles.noGrades}>No assessments recorded.</Text>
              ) : (
                <>
                  <View style={styles.gradeTableHeader}>
                    <Text style={[styles.colName, styles.colHeaderText]}>Assessment</Text>
                    <Text style={[styles.colType, styles.colHeaderText]}>Type</Text>
                    <Text style={[styles.colScore, styles.colHeaderText]}>Score</Text>
                    <Text style={[styles.colGrade, styles.colHeaderText]}>Grade</Text>
                  </View>
                  {cls.gradebooks.map((gb, j) => {
                    const isLast = j === cls.gradebooks.length - 1
                    return (
                      <View key={j} style={isLast ? styles.gradeRowLast : styles.gradeRow}>
                        <Text style={styles.colName}>{gb.name}</Text>
                        <Text style={styles.colType}>{gb.type}</Text>
                        <Text style={[styles.colScore, { color: scoreColor(gb.score, gb.maxScore) }]}>
                          {gb.score !== null ? `${gb.score}/${gb.maxScore}` : '—'}
                        </Text>
                        <Text style={[styles.colGrade, { color: scoreColor(gb.score, gb.maxScore) }]}>
                          {gb.letterGrade ?? '—'}
                        </Text>
                      </View>
                    )
                  })}
                </>
              )}
            </View>
          ))
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{school.name} — Confidential Student Report</Text>
          <Text style={styles.footerText}>Generated {generatedAt}</Text>
        </View>
      </Page>
    </Document>
  )
}
