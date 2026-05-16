'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { eventsApi } from '@/services/events'
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from '@/types/event'

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
      createdAt: new Date().toISOString(),
    }
    setEvents(prev =>
      [...prev, tempEvent].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.startTime ?? '').localeCompare(b.startTime ?? ''),
      ),
    )
    const result = await eventsApi.criar(dados)
    if (result.data) {
      setEvents(prev => prev.map(e => (e.id === tempId ? result.data! : e)))
    } else {
      setEvents(prev => prev.filter(e => e.id !== tempId))
      toast.error('Não foi possível criar o evento')
    }
  }

  async function updateEvent(id: string, dados: UpdateEventInput): Promise<void> {
    const anterior = events.find(e => e.id === id)
    if (!anterior) return
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, ...dados } : e)))
    const result = await eventsApi.atualizar(id, dados)
    if (!result.data) {
      setEvents(prev => prev.map(e => (e.id === id ? anterior : e)))
      toast.error('Não foi possível actualizar o evento')
    }
  }

  async function deleteEvent(id: string): Promise<void> {
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
