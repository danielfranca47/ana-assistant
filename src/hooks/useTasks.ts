'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { tasksApi } from '@/services/tasks'
import type { Task, CreateTaskInput, UpdateTaskInput } from '@/types/task'

export function useTasks(date: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMutating, setIsMutating] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const result = await tasksApi.listar(date)
    if (result.data !== null) {
      setTasks(result.data)
    } else {
      setError(result.error)
    }
    setIsLoading(false)
  }, [date])

  useEffect(() => {
    void load()
  }, [load])

  async function createTask(dados: CreateTaskInput): Promise<void> {
    const tempId = `temp-${Date.now()}`
    const tempTask: Task = {
      id: tempId,
      userId: '',
      name: dados.name,
      time: dados.time ?? null,
      duration: dados.duration ?? null,
      priority: dados.priority ?? 'media',
      category: dados.category ?? null,
      status: dados.status ?? 'pending',
      date: dados.date,
      createdAt: new Date().toISOString(),
    }
    setTasks(prev => [...prev, tempTask])
    setIsMutating(true)
    const result = await tasksApi.criar(dados)
    setIsMutating(false)
    if (result.data) {
      setTasks(prev => prev.map(t => t.id === tempId ? result.data! : t))
    } else {
      setTasks(prev => prev.filter(t => t.id !== tempId))
      toast.error('Não foi possível criar a tarefa')
    }
  }

  async function updateTask(id: string, dados: UpdateTaskInput): Promise<void> {
    const anterior = tasks.find(t => t.id === id)
    if (!anterior) return
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...dados } : t))
    const result = await tasksApi.atualizar(id, dados)
    if (!result.data) {
      setTasks(prev => prev.map(t => t.id === id ? anterior : t))
      toast.error('Não foi possível actualizar a tarefa')
    }
  }

  async function deleteTask(id: string): Promise<void> {
    const anterior = tasks.find(t => t.id === id)
    if (!anterior) return
    const idxAnterior = tasks.findIndex(t => t.id === id)
    setTasks(prev => prev.filter(t => t.id !== id))
    const result = await tasksApi.deletar(id)
    if (result.error !== null) {
      setTasks(prev => {
        const copy = [...prev]
        copy.splice(idxAnterior, 0, anterior)
        return copy
      })
      toast.error('Não foi possível apagar a tarefa')
    }
  }

  return { tasks, isLoading, error, isMutating, createTask, updateTask, deleteTask }
}
