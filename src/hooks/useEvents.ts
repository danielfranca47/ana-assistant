'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { eventsApi } from '@/services/events'
import type { CalendarEvent, CreateEventInput, UpdateEventInput, RecurrenceScope } from '@/types/event'

function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? '').localeCompare(b.startTime ?? ''),
  )
}

export function useEvents(from: string, to: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const result = await eventsApi.listar(from, to)
    if (result.data !== null) {
      setEvents(result.data)
    }
    setIsLoading(false)
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  async function createEvent(dados: CreateEventInput): Promise<void> {
    const tempId = `temp-${Date.now()}`
    const tempEvent: CalendarEvent = {
      id: tempId,
      userId: '',
      name: dados.name,
      date: `${dados.date}T00:00:00.000Z`,
      startTime: dados.startTime ?? null,
      endTime: dados.endTime ?? null,
      category: dados.category ?? 'pers',
      notes: dados.notes ?? null,
      recurrence: dados.recurrence ?? null,
      recurrenceDays: dados.recurrenceDays ?? null,
      recurrenceEnd: null,
      parentId: null,
      createdAt: new Date().toISOString(),
    }
    setEvents(prev => sortEvents([...prev, tempEvent]))

    const result = await eventsApi.criar(dados)
    if (result.data) {
      setEvents(prev => sortEvents([
        ...prev.filter(e => e.id !== tempId),
        ...result.data!,
      ]))
    } else {
      setEvents(prev => prev.filter(e => e.id !== tempId))
      toast.error('Não foi possível criar o evento')
    }
  }

  async function updateEvent(id: string, dados: UpdateEventInput, scope?: RecurrenceScope): Promise<void> {
    const dadosComScope: UpdateEventInput = scope ? { ...dados, scope } : dados

    if (scope && scope !== 'single') {
      const result = await eventsApi.atualizar(id, dadosComScope)
      if (result.error !== null) {
        toast.error('Não foi possível actualizar o evento')
      }
      await load()
      return
    }

    // Optimistic update para 'single'
    const anterior = events.find(e => e.id === id)
    if (!anterior) return
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, ...dados } : e)))
    const result = await eventsApi.atualizar(id, dadosComScope)
    if (!result.data) {
      setEvents(prev => prev.map(e => (e.id === id ? anterior : e)))
      toast.error('Não foi possível actualizar o evento')
    }
  }

  async function deleteEvent(id: string, scope?: RecurrenceScope): Promise<void> {
    if (scope && scope !== 'single') {
      const anterior = [...events]
      // Remoção optimista básica
      if (scope === 'all') {
        const ev = events.find(e => e.id === id)
        const rootId = ev?.parentId ?? id
        setEvents(prev => prev.filter(e => e.id !== rootId && e.parentId !== rootId))
      } else {
        // 'following' — remove este e futuros com o mesmo parentId
        const ev = events.find(e => e.id === id)
        const rootId = ev?.parentId ?? id
        setEvents(prev => prev.filter(e => {
          if (e.id === id) return false
          if ((e.parentId === rootId) && e.date >= (ev?.date ?? '')) return false
          return true
        }))
      }
      const result = await eventsApi.deletar(id, scope)
      if (result.error !== null) {
        setEvents(anterior)
        toast.error('Não foi possível apagar o evento')
      }
      await load()
      return
    }

    // 'single' — comportamento original
    const anterior = events.find(e => e.id === id)
    if (!anterior) return
    const idxAnterior = events.findIndex(e => e.id === id)
    setEvents(prev => prev.filter(e => e.id !== id))
    const result = await eventsApi.deletar(id)
    if (result.error !== null) {
      setEvents(prev => {
        const copy = [...prev]
        copy.splice(idxAnterior, 0, anterior)
        return copy
      })
      toast.error('Não foi possível apagar o evento')
    }
  }

  return { events, isLoading, createEvent, updateEvent, deleteEvent }
}
