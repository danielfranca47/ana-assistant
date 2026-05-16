import { apiFetch } from '@/lib/apiFetch'
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from '@/types/event'

export const eventsApi = {
  listar: (from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    return apiFetch.get<CalendarEvent[]>(qs ? `/api/events?${qs}` : '/api/events')
  },

  criar: (dados: CreateEventInput) =>
    apiFetch.post<CalendarEvent>('/api/events', dados),

  atualizar: (id: string, dados: UpdateEventInput) =>
    apiFetch.patch<CalendarEvent>(`/api/events/${id}`, dados),

  deletar: (id: string) =>
    apiFetch.delete(`/api/events/${id}`),
}
