import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import { eventsApi } from '../services/events'
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from '../types/event'

export function useEventsQuery(from: string, to: string) {
  return useQuery({
    queryKey: ['events', from, to],
    queryFn: () => eventsApi.listar(from, to).then((r) => r.data.data),
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (dados: CreateEventInput) =>
      eventsApi.criar(dados).then((r) => r.data.data),

    onMutate: async (novoEvento) => {
      await qc.cancelQueries({ queryKey: ['events'] })

      // Snapshot de todos os caches de eventos ativos para rollback
      const snapshots = qc.getQueriesData<CalendarEvent[]>({ queryKey: ['events'] })

      const otimista: CalendarEvent = {
        ...novoEvento,
        id: `temp-${Date.now()}`,
        userId: '',
        startTime: novoEvento.startTime ?? null,
        endTime: novoEvento.endTime ?? null,
        category: novoEvento.category ?? 'pers',
        notes: novoEvento.notes ?? null,
        createdAt: new Date().toISOString(),
      }

      snapshots.forEach(([key]) => {
        qc.setQueryData<CalendarEvent[]>(key as QueryKey, (old) => [
          ...(old ?? []),
          otimista,
        ])
      })

      return { snapshots }
    },

    onError: (_err, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => {
        qc.setQueryData(key as QueryKey, data)
      })
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

export function useUpdateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...dados }: UpdateEventInput & { id: string }) =>
      eventsApi.atualizar(id, dados).then((r) => r.data.data),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => eventsApi.deletar(id),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['events'] })
    },
  })
}
