const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export type ConflictType = 'teacher-clash' | 'room-clash'

export type TimetableConflict = {
  type: ConflictType
  day: number
  period: number
  slotIds: string[]
  description: string
}

export type ConflictSlot = {
  id: string
  staffId: string | null
  roomId: string | null
  dayOfWeek: number
  period: number
  class: { name: string }
  staff: { user: { name: string } } | null
  room: { code: string } | null
}

export function detectConflicts(slots: ConflictSlot[]): TimetableConflict[] {
  const conflicts: TimetableConflict[] = []

  // Teacher clashes: same staffId at same day + period
  const teacherMap = new Map<string, ConflictSlot[]>()
  for (const slot of slots) {
    if (!slot.staffId) continue
    const key = `staff-${slot.staffId}-${slot.dayOfWeek}-${slot.period}`
    const group = teacherMap.get(key) ?? []
    group.push(slot)
    teacherMap.set(key, group)
  }
  for (const group of teacherMap.values()) {
    if (group.length < 2) continue
    const teacherName = group[0].staff?.user.name ?? 'Unknown teacher'
    const dayName = DAY_NAMES[group[0].dayOfWeek - 1] ?? `Day ${group[0].dayOfWeek}`
    conflicts.push({
      type: 'teacher-clash',
      day: group[0].dayOfWeek,
      period: group[0].period,
      slotIds: group.map(s => s.id),
      description: `${teacherName} is double-booked on ${dayName} P${group[0].period} (${group.map(s => s.class.name).join(' & ')})`,
    })
  }

  // Room clashes: same roomId at same day + period
  const roomMap = new Map<string, ConflictSlot[]>()
  for (const slot of slots) {
    if (!slot.roomId) continue
    const key = `room-${slot.roomId}-${slot.dayOfWeek}-${slot.period}`
    const group = roomMap.get(key) ?? []
    group.push(slot)
    roomMap.set(key, group)
  }
  for (const group of roomMap.values()) {
    if (group.length < 2) continue
    const roomCode = group[0].room?.code ?? 'Unknown room'
    const dayName = DAY_NAMES[group[0].dayOfWeek - 1] ?? `Day ${group[0].dayOfWeek}`
    conflicts.push({
      type: 'room-clash',
      day: group[0].dayOfWeek,
      period: group[0].period,
      slotIds: group.map(s => s.id),
      description: `Room ${roomCode} is double-booked on ${dayName} P${group[0].period} (${group.map(s => s.class.name).join(' & ')})`,
    })
  }

  return conflicts
}
