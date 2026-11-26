'use client'

import CsvImportPanel, { type CsvRowCheck } from '@/components/csv-import-panel'
import { importEnrolmentsAction } from './actions'

const COLUMNS = ['studentCode', 'classCode']

function validateEnrolmentRow(data: Record<string, string>): CsvRowCheck {
  const errors: string[] = []
  if (!data.studentCode) errors.push('studentCode is required')
  if (!data.classCode) errors.push('classCode is required')
  return { errors, warnings: [] }
}

export default function EnrolmentsImportClient() {
  return (
    <CsvImportPanel
      columns={COLUMNS}
      formatHelp="studentCode is the student's ID shown on their profile. classCode is the code of a class in the active academic year. A full class adds the student to its waitlist. Students already enrolled or waitlisted are skipped."
      templateHref="/templates/enrolments-template.csv"
      validate={validateEnrolmentRow}
      importRows={importEnrolmentsAction}
      successHref="/classes"
      entityLabel="enrolment(s)"
    />
  )
}
