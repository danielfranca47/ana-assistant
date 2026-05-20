export type EventCategory = 'work' | 'meet' | 'pers' | 'break'

export type RecurrenceScope = 'single' | 'following' | 'all'

// Nomeado CalendarEvent para evitar conflito com o global Event do DOM
export interface CalendarEvent {
  id: string
  userId: string
  name: string
  date: string // YYYY-MM-DD
  startTime: string | null
  endTime: string | null
  category: EventCategory
  notes: string | null
  recurrence: string | null
  recurrenceDays: string | null
  recurrenceEnd: string | null
  parentId: string | null
  createdAt: string
}

export interface CreateEventInput {
  name: string
  date: string
  startTime?: string
  endTime?: string
  category?: EventCategory
  notes?: string
  recurrence?: string
  recurrenceDays?: string   // JSON ex: "[1,3,5]"
  recurrenceEnd?: string    // YYYY-MM-DD
}

export interface UpdateEventInput {
  name?: string
  date?: string
  startTime?: string
  endTime?: string
  category?: EventCategory
  notes?: string
  recurrence?: string
  recurrenceDays?: string
  recurrenceEnd?: string
  scope?: RecurrenceScope
}
