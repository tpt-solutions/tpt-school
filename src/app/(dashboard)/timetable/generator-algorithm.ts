export interface Requirement {
  id: string
  classId: string
  staffId: string | null
  preferredRoomId: string | null
  periodsPerWeek: number
  label: string | null
}

export interface ProposedSlot {
  requirementId: string
  classId: string
  staffId: string | null
  roomId: string | null
  dayOfWeek: number
  period: number
  startTime: string
  endTime: string
  warning?: string
}

// Returns default start/end times matching timetable-grid.tsx conventions
function slotStartTime(period: number): string {
  const totalMinutes = 8 * 60 + 30 + (period - 1) * 60
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0')
  const m = (totalMinutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function slotEndTime(period: number): string {
  const totalMinutes = 8 * 60 + 30 + period * 60
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0')
  const m = (totalMinutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

// Preferred day distributions by periodsPerWeek
const DAY_PATTERNS: Record<number, number[]> = {
  1: [3],
  2: [2, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
}

const ALL_DAYS = [1, 2, 3, 4, 5]
const ALL_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

export function generateSlots(
  requirements: Requirement[],
  existingSlots: { classId: string; staffId: string | null; roomId: string | null; dayOfWeek: number; period: number }[],
): ProposedSlot[] {
  // Build conflict sets for O(1) lookups
  const classBooked = new Set<string>()
  const staffBooked = new Set<string>()
  const roomBooked = new Set<string>()

  for (const s of existingSlots) {
    classBooked.add(`${s.classId}|${s.dayOfWeek}|${s.period}`)
    if (s.staffId) staffBooked.add(`${s.staffId}|${s.dayOfWeek}|${s.period}`)
    if (s.roomId) roomBooked.add(`${s.roomId}|${s.dayOfWeek}|${s.period}`)
  }

  // Sort most constrained first
  const sorted = [...requirements].sort((a, b) => b.periodsPerWeek - a.periodsPerWeek)

  const proposed: ProposedSlot[] = []

  for (const req of sorted) {
    const preferredDays = DAY_PATTERNS[req.periodsPerWeek] ?? ALL_DAYS
    let daysToSchedule = [...preferredDays]

    // If periodsPerWeek > 5 or no pattern, fill with round-robin
    if (req.periodsPerWeek > 5) {
      daysToSchedule = []
      for (let i = 0; i < req.periodsPerWeek; i++) {
        daysToSchedule.push(ALL_DAYS[i % 5])
      }
    }

    let scheduled = 0

    for (const day of daysToSchedule) {
      if (scheduled >= req.periodsPerWeek) break

      // Try to find a free period on this day
      let placed = false
      for (const period of ALL_PERIODS) {
        const classKey = `${req.classId}|${day}|${period}`
        const staffKey = req.staffId ? `${req.staffId}|${day}|${period}` : null
        const roomKey = req.preferredRoomId ? `${req.preferredRoomId}|${day}|${period}` : null

        if (classBooked.has(classKey)) continue
        if (staffKey && staffBooked.has(staffKey)) continue

        // Determine room to assign
        let assignedRoom: string | null = null
        let warning: string | undefined

        if (req.preferredRoomId) {
          if (roomKey && !roomBooked.has(roomKey)) {
            assignedRoom = req.preferredRoomId
          } else {
            // Preferred room taken — schedule without room and warn
            warning = `Preferred room unavailable on day ${day} period ${period}`
          }
        }

        // Mark as booked
        classBooked.add(classKey)
        if (staffKey) staffBooked.add(staffKey)
        if (assignedRoom && roomKey) roomBooked.add(roomKey)

        proposed.push({
          requirementId: req.id,
          classId: req.classId,
          staffId: req.staffId,
          roomId: assignedRoom,
          dayOfWeek: day,
          period,
          startTime: slotStartTime(period),
          endTime: slotEndTime(period),
          ...(warning ? { warning } : {}),
        })

        scheduled++
        placed = true
        break
      }

      // If preferred day was full, try other days as fallback
      if (!placed) {
        for (const fallbackDay of ALL_DAYS) {
          if (fallbackDay === day) continue
          if (scheduled >= req.periodsPerWeek) break

          for (const period of ALL_PERIODS) {
            const classKey = `${req.classId}|${fallbackDay}|${period}`
            const staffKey = req.staffId ? `${req.staffId}|${fallbackDay}|${period}` : null
            const roomKey = req.preferredRoomId ? `${req.preferredRoomId}|${fallbackDay}|${period}` : null

            if (classBooked.has(classKey)) continue
            if (staffKey && staffBooked.has(staffKey)) continue

            let assignedRoom: string | null = null
            let warning: string | undefined

            if (req.preferredRoomId) {
              if (roomKey && !roomBooked.has(roomKey)) {
                assignedRoom = req.preferredRoomId
              } else {
                warning = `Preferred room unavailable on day ${fallbackDay} period ${period}`
              }
            }

            classBooked.add(classKey)
            if (staffKey) staffBooked.add(staffKey)
            if (assignedRoom && roomKey) roomBooked.add(roomKey)

            proposed.push({
              requirementId: req.id,
              classId: req.classId,
              staffId: req.staffId,
              roomId: assignedRoom,
              dayOfWeek: fallbackDay,
              period,
              startTime: slotStartTime(period),
              endTime: slotEndTime(period),
              ...(warning ? { warning } : {}),
            })

            scheduled++
            placed = true
            break
          }
          if (placed) break
        }
      }
    }
  }

  return proposed
}
