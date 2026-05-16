export type EventCategory = 'work' | 'meet' | 'pers' | 'break'

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
  createdAt: string
}

export interface CreateEventInput {
  name: string
  date: string
  startTime?: string
  endTime?: string
  category?: EventCategory
  notes?: string
}

export interface UpdateEventInput {
  name?: string
  date?: string
  startTime?: string
  endTime?: string
  category?: EventCategory
  notes?: string
}
