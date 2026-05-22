'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { saveGradesAction } from '../actions'
import { CheckCircle2 } from 'lucide-react'

type StudentRow = {
  studentId: string
  name: string
  studentCode: string
  existingScore?: number | null
  existingGrade?: string | null
  existingComment?: string | null
}

interface GradeEntryProps {
  gradebookId: string
  maxScore: number
  students: StudentRow[]
}

export default function GradeEntry({ gradebookId, maxScore, students }: GradeEntryProps) {
  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(
      students.map((s) => [s.studentId, s.existingScore != null ? String(s.existingScore) : ''])
    )
  )
  const [grades, setGrades] = useState<Record<string, string>>(
    Object.fromEntries(students.map((s) => [s.studentId, s.existingGrade ?? '']))
  )
  const [comments, setComments] = useState<Record<string, string>>(
    Object.fromEntries(students.map((s) => [s.studentId, s.existingComment ?? '']))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function autoGrade(score: number, max: number): string {
    const pct = (score / max) * 100
    if (pct >= 90) return 'A+'
    if (pct >= 85) return 'A'
    if (pct >= 80) return 'A-'
    if (pct >= 75) return 'B+'
    if (pct >= 70) return 'B'
    if (pct >= 65) return 'B-'
    if (pct >= 60) return 'C+'
    if (pct >= 55) return 'C'
    if (pct >= 50) return 'C-'
    if (pct >= 40) return 'D'
    return 'E'
  }

  function handleScoreChange(studentId: string, value: string) {
    setScores({ ...scores, [studentId]: value })
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0 && num <= maxScore) {
      setGrades({ ...grades, [studentId]: autoGrade(num, maxScore) })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    const entries = students.map((s) => {
      const scoreStr = scores[s.studentId]
      const scoreNum = scoreStr !== '' ? parseFloat(scoreStr) : null
      return {
        studentId: s.studentId,
        score: scoreNum,
        grade: grades[s.studentId] || null,
        comment: comments[s.studentId] || null,
      }
    })

    const result = await saveGradesAction(gradebookId, entries)
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const graded = Object.values(scores).filter((s) => s !== '').length

  if (students.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>No students enrolled in this class</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Grades saved successfully
        </div>
      )}

      <div className="text-sm text-slate-500">
        {graded} of {students.length} students graded
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-6 py-3 font-medium text-slate-600">Student</th>
              <th className="px-4 py-3 font-medium text-slate-600 w-32">
                Score <span className="font-normal text-slate-400">/ {maxScore}</span>
              </th>
              <th className="px-4 py-3 font-medium text-slate-600 w-24">Grade</th>
              <th className="px-4 py-3 font-medium text-slate-600">Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {students.map((student) => {
              const scoreVal = scores[student.studentId]
              const scoreNum = parseFloat(scoreVal)
              const pct = !isNaN(scoreNum) && scoreVal !== '' ? Math.round((scoreNum / maxScore) * 100) : null

              return (
                <tr key={student.studentId} className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <p className="font-medium text-slate-800">{student.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{student.studentCode}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={maxScore}
                        step={0.5}
                        value={scoreVal}
                        onChange={(e) => handleScoreChange(student.studentId, e.target.value)}
                        className="w-20 text-center"
                        placeholder="—"
                      />
                      {pct !== null && (
                        <span className={`text-xs font-medium ${pct >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                          {pct}%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      value={grades[student.studentId]}
                      onChange={(e) => setGrades({ ...grades, [student.studentId]: e.target.value })}
                      className="w-16 text-center font-medium"
                      placeholder="—"
                      maxLength={3}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Textarea
                      value={comments[student.studentId]}
                      onChange={(e) => setComments({ ...comments, [student.studentId]: e.target.value })}
                      placeholder="Optional comment..."
                      rows={1}
                      className="text-sm resize-none"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-4">
        <Button type="submit" disabled={saving} className="shadow-lg">
          {saving ? 'Saving...' : 'Save All Grades'}
        </Button>
      </div>
    </form>
  )
}
