import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { tasksApi } from '../services/tasks'
import type { CreateTaskInput, UpdateTaskInput } from '../types/task'

export function useTasksQuery(date: string) {
  return useQuery({
    queryKey: ['tasks', date],
    queryFn: () => tasksApi.listar(date).then((r) => r.data.data),
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dados: CreateTaskInput) =>
      tasksApi.criar(dados).then((r) => r.data.data),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['tasks', vars.date] })
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...dados }: UpdateTaskInput & { id: string }) =>
      tasksApi.atualizar(id, dados).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tasksApi.deletar(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
