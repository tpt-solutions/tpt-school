'use client'

import CsvImportPanel, { type CsvRowCheck } from '@/components/csv-import-panel'
import { importTimetableAction } from './actions'

const COLUMNS = ['classCode', 'day', 'period', 'startTime', 'endTime', 'roomCode', 'teacherId', 'notes']

function validateTimetableRow(data: Record<string, string>): CsvRowCheck {
  const errors: string[] = []
  const warnings: string[] = []

  if (!data.classCode) errors.push('classCode is required')
  if (!data.day) errors.push('day is required (Mon to Fri)')
  if (!data.period || !/^\d+$/.test(data.period)) errors.push('period must be a whole number')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.startTime ?? '')) errors.push('startTime must be HH:MM')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.endTime ?? '')) errors.push('endTime must be HH:MM')
  if (!data.roomCode && !data.teacherId) warnings.push('No room or teacher: the slot will not conflict-check either')

  return { errors, warnings }
}

export default function TimetableImportClient() {
  return (
    <CsvImportPanel
      columns={COLUMNS}
      formatHelp="One row per period. classCode must match a class in the active academic year; roomCode and teacherId (employee ID) are optional. Rows that clash with an existing room, teacher or class period are skipped and reported."
      templateHref="/templates/timetable-template.csv"
      validate={validateTimetableRow}
      importRows={importTimetableAction}
      successHref="/timetable"
      entityLabel="timetable slot(s)"
    />
  )
}
