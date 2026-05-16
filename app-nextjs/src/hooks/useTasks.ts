'use client'

import { useState, useEffect, useCallback } from 'react'
import { tasksApi } from '@/services/tasks'
import type { Task, CreateTaskInput, UpdateTaskInput } from '@/types/task'

const TASKS_EVENT = 'tasks-changed'

export function useTasksQuery(date: string) {
  const [data, setData] = useState<Task[] | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setIsError(false)
    const result = await tasksApi.listar(date)
    if (result.data !== null) {
      setData(result.data)
    } else {
      setIsError(true)
    }
    setIsLoading(false)
  }, [date])

  useEffect(() => {
    void load()
    window.addEventListener(TASKS_EVENT, load)
    return () => window.removeEventListener(TASKS_EVENT, load)
  }, [load])

  return { data, isLoading, isError }
}

function dispararRefetch() {
  window.dispatchEvent(new Event(TASKS_EVENT))
}

export function useCreateTask() {
  const [isPending, setIsPending] = useState(false)

  const mutateAsync = async (dados: CreateTaskInput): Promise<Task> => {
    setIsPending(true)
    const result = await tasksApi.criar(dados)
    setIsPending(false)
    if (!result.data) throw new Error(result.error ?? 'Erro inesperado')
    dispararRefetch()
    return result.data
  }

  return {
    mutateAsync,
    mutate: (dados: CreateTaskInput) => void mutateAsync(dados),
    isPending,
  }
}

export function useUpdateTask() {
  const [isPending, setIsPending] = useState(false)

  const mutateAsync = async (dados: UpdateTaskInput & { id: string }): Promise<Task> => {
    const { id, ...resto } = dados
    setIsPending(true)
    const result = await tasksApi.atualizar(id, resto)
    setIsPending(false)
    if (!result.data) throw new Error(result.error ?? 'Erro inesperado')
    dispararRefetch()
    return result.data
  }

  return {
    mutateAsync,
    mutate: (dados: UpdateTaskInput & { id: string }) => void mutateAsync(dados),
    isPending,
  }
}

export function useDeleteTask() {
  const [isPending, setIsPending] = useState(false)

  const mutateAsync = async (id: string): Promise<void> => {
    setIsPending(true)
    await tasksApi.deletar(id)
    setIsPending(false)
    dispararRefetch()
  }

  return {
    mutateAsync,
    mutate: (id: string) => void mutateAsync(id),
    isPending,
  }
}
