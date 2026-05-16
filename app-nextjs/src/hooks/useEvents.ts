'use client'

import { useState, useEffect, useCallback } from 'react'
import { eventsApi } from '@/services/events'
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from '@/types/event'

const EVENTS_EVENT = 'events-changed'

export function useEventsQuery(from: string, to: string) {
  const [data, setData] = useState<CalendarEvent[] | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setIsError(false)
    const result = await eventsApi.listar(from, to)
    if (result.data !== null) {
      setData(result.data)
    } else {
      setIsError(true)
    }
    setIsLoading(false)
  }, [from, to])

  useEffect(() => {
    void load()
    window.addEventListener(EVENTS_EVENT, load)
    return () => window.removeEventListener(EVENTS_EVENT, load)
  }, [load])

  return { data, isLoading, isError }
}

function dispararRefetch() {
  window.dispatchEvent(new Event(EVENTS_EVENT))
}

export function useCreateEvent() {
  const [isPending, setIsPending] = useState(false)

  const mutateAsync = async (dados: CreateEventInput): Promise<CalendarEvent> => {
    setIsPending(true)
    const result = await eventsApi.criar(dados)
    setIsPending(false)
    if (!result.data) throw new Error(result.error ?? 'Erro inesperado')
    dispararRefetch()
    return result.data
  }

  return {
    mutateAsync,
    mutate: (dados: CreateEventInput) => void mutateAsync(dados),
    isPending,
  }
}

export function useUpdateEvent() {
  const [isPending, setIsPending] = useState(false)

  const mutateAsync = async (dados: UpdateEventInput & { id: string }): Promise<CalendarEvent> => {
    const { id, ...resto } = dados
    setIsPending(true)
    const result = await eventsApi.atualizar(id, resto)
    setIsPending(false)
    if (!result.data) throw new Error(result.error ?? 'Erro inesperado')
    dispararRefetch()
    return result.data
  }

  return {
    mutateAsync,
    mutate: (dados: UpdateEventInput & { id: string }) => void mutateAsync(dados),
    isPending,
  }
}

export function useDeleteEvent() {
  const [isPending, setIsPending] = useState(false)

  const mutateAsync = async (id: string): Promise<void> => {
    setIsPending(true)
    await eventsApi.deletar(id)
    setIsPending(false)
    dispararRefetch()
  }

  return {
    mutateAsync,
    mutate: (id: string) => void mutateAsync(id),
    isPending,
  }
}
