import { apiFetch } from '@/lib/apiFetch'
import type { Task, CreateTaskInput, UpdateTaskInput } from '@/types/task'

export const tasksApi = {
  listar: (date?: string) =>
    apiFetch.get<Task[]>(date ? `/api/tasks?date=${date}` : '/api/tasks'),

  criar: (dados: CreateTaskInput) =>
    apiFetch.post<Task>('/api/tasks', dados),

  atualizar: (id: string, dados: UpdateTaskInput) =>
    apiFetch.patch<Task>(`/api/tasks/${id}`, dados),

  deletar: (id: string) =>
    apiFetch.delete(`/api/tasks/${id}`),
}
