import api from './api'
import type { Task, CreateTaskInput, UpdateTaskInput } from '../types/task'

export const tasksApi = {
  listar: (date?: string) =>
    api.get<{ data: Task[] }>('/tasks', { params: date ? { date } : {} }),

  criar: (dados: CreateTaskInput) =>
    api.post<{ data: Task }>('/tasks', dados),

  atualizar: (id: string, dados: UpdateTaskInput) =>
    api.patch<{ data: Task }>(`/tasks/${id}`, dados),

  deletar: (id: string) => api.delete(`/tasks/${id}`),
}
