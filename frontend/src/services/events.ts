import api from './api'
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from '../types/event'

export const eventsApi = {
  listar: (from?: string, to?: string) =>
    api.get<{ data: CalendarEvent[] }>('/events', {
      params: { ...(from && { from }), ...(to && { to }) },
    }),

  criar: (dados: CreateEventInput) =>
    api.post<{ data: CalendarEvent }>('/events', dados),

  atualizar: (id: string, dados: UpdateEventInput) =>
    api.patch<{ data: CalendarEvent }>(`/events/${id}`, dados),

  deletar: (id: string) => api.delete(`/events/${id}`),
}
