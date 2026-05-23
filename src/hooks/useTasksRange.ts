'use client'

import { useState, useEffect, useCallback } from 'react'
import { tasksApi } from '@/services/tasks'
import type { Task } from '@/types/task'

export function useTasksRange(from: string, to: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const result = await tasksApi.listarIntervalo(from, to)
    if (result.data !== null) {
      setTasks(result.data.tasks)
    }
    setIsLoading(false)
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  return { tasks, isLoading }
}
