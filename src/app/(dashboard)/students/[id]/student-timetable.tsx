const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

type Slot = {
  id: string
  dayOfWeek: number
  period: number
  startTime: string
  endTime: string
  class: { name: string }
  room: { code: string } | null
}

export default function StudentTimetable({ slots }: { slots: Slot[] }) {
  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400 shadow-sm">
        No timetable slots have been scheduled for this student&apos;s classes yet.
      </div>
    )
  }

  const slotMap = new Map<string, Slot>()
  for (const slot of slots) {
    slotMap.set(`${slot.dayOfWeek}-${slot.period}`, slot)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-20">Period</th>
              {DAY_NAMES.map((day) => (
                <th key={day} className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <tr key={period} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-3 text-xs text-slate-400 font-medium align-top whitespace-nowrap">
                  P{period}
                  {slotMap.get(`1-${period}`) && (
                    <div className="text-slate-300">{slotMap.get(`1-${period}`)!.startTime}</div>
                  )}
                </td>
                {[1, 2, 3, 4, 5].map((day) => {
                  const slot = slotMap.get(`${day}-${period}`)
                  return (
                    <td key={day} className="px-2 py-2 align-top">
                      {slot ? (
                        <div className="rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-2">
                          <p className="font-medium text-primary text-xs leading-tight">{slot.class.name}</p>
                          {slot.room && (
                            <p className="text-xs text-primary/60 mt-0.5">{slot.room.code}</p>
                          )}
                        </div>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
