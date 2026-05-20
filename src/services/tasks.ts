import { apiFetch } from '@/lib/apiFetch'
import type { Task, CreateTaskInput, UpdateTaskInput } from '@/types/task'

export const tasksApi = {
  listar: (date?: string) =>
    apiFetch.get<{ tasks: Task[] }>(date ? `/api/tasks?date=${date}` : '/api/tasks'),

  listarIntervalo: (from: string, to: string) =>
    apiFetch.get<{ tasks: Task[] }>(`/api/tasks?from=${from}&to=${to}&limit=100`),

  criar: (dados: CreateTaskInput) =>
    apiFetch.post<Task>('/api/tasks', dados),

  atualizar: (id: string, dados: UpdateTaskInput, scope?: string) =>
    apiFetch.patch<Task>(`/api/tasks/${id}${scope ? `?scope=${scope}` : ''}`, dados),

  deletar: (id: string, scope?: string) =>
    apiFetch.delete(`/api/tasks/${id}${scope ? `?scope=${scope}` : ''}`),

  marcarAtrasadas: () =>
    apiFetch.post<{ updated: number }>('/api/tasks/mark-overdue', {}),

  listarAtrasadas: () =>
    apiFetch.get<{ tasks: Task[] }>('/api/tasks/overdue'),
}
