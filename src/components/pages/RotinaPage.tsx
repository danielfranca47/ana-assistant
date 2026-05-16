'use client'

import { useState, type FormEvent } from 'react'
import { useTasks } from '@/hooks/useTasks'
import type { Task, TaskPriority, TaskStatus } from '@/types/task'

function hoje(): string {
  return new Date().toISOString().split('T')[0]
}

function adicionarDias(dateStr: string, dias: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

function formatarData(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

const PRIORIDADE_COR: Record<TaskPriority, string> = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-yellow-100 text-yellow-700',
  baixa: 'bg-green-100 text-green-700',
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pendente',
  done: 'Concluída',
  current: 'Em andamento',
  late: 'Atrasada',
}

const STATUS_COR: Record<TaskStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  done: 'bg-green-100 text-green-700',
  current: 'bg-blue-100 text-blue-700',
  late: 'bg-red-100 text-red-700',
}

const PROXIMO_STATUS: Record<TaskStatus, TaskStatus> = {
  pending: 'done',
  done: 'pending',
  current: 'done',
  late: 'pending',
}

interface FormState {
  name: string
  time: string
  duration: string
  priority: TaskPriority
  category: string
}

const FORM_INICIAL: FormState = {
  name: '',
  time: '',
  duration: '',
  priority: 'media',
  category: '',
}

export default function RotinaPage() {
  const [dataSelecionada, setDataSelecionada] = useState(hoje())
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_INICIAL)

  const { tasks, isLoading, error, isMutating, createTask, updateTask, deleteTask } =
    useTasks(dataSelecionada)

  async function handleCriar(e: FormEvent) {
    e.preventDefault()
    await createTask({
      name: form.name,
      date: dataSelecionada,
      time: form.time || undefined,
      duration: form.duration ? Number(form.duration) : undefined,
      priority: form.priority,
      category: form.category || undefined,
    })
    setForm(FORM_INICIAL)
    setMostrarForm(false)
  }

  function toggleStatus(task: Task) {
    void updateTask(task.id, { status: PROXIMO_STATUS[task.status] })
  }

  return (
    <div className="overflow-y-auto h-full" style={{ background: 'var(--ana-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Navegação de data */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setDataSelecionada(adicionarDias(dataSelecionada, -1))}
            className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
          >
            ←
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-500 capitalize">
              {formatarData(dataSelecionada)}
            </p>
            {dataSelecionada !== hoje() && (
              <button
                onClick={() => setDataSelecionada(hoje())}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                voltar para hoje
              </button>
            )}
          </div>

          <button
            onClick={() => setDataSelecionada(adicionarDias(dataSelecionada, 1))}
            className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
          >
            →
          </button>
        </div>

        {/* Cabeçalho com botão */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Rotina</h1>
          <button
            onClick={() => setMostrarForm(!mostrarForm)}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            {mostrarForm ? 'Cancelar' : '+ Nova tarefa'}
          </button>
        </div>

        {/* Formulário de criação */}
        {mostrarForm && (
          <form
            onSubmit={handleCriar}
            className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3"
          >
            <div>
              <input
                type="text"
                required
                placeholder="Nome da tarefa"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Horário</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Duração (min)
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="30"
                  value={form.duration}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, duration: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Prioridade</label>
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      priority: e.target.value as TaskPriority,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Categoria</label>
                <input
                  type="text"
                  placeholder="Ex: trabalho"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isMutating}
              className="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {isMutating ? 'Salvando...' : 'Salvar tarefa'}
            </button>
          </form>
        )}

        {/* Skeleton loader */}
        {isLoading && (
          <ul className="space-y-2">
            {[1, 2, 3].map(i => (
              <li
                key={i}
                className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-start gap-3 animate-pulse"
              >
                <div className="w-12 h-4 bg-gray-200 rounded mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="w-16 h-6 bg-gray-200 rounded-full" />
              </li>
            ))}
          </ul>
        )}

        {/* Estado de erro */}
        {!isLoading && error !== null && (
          <div className="text-center py-12 text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Lista vazia */}
        {!isLoading && error === null && tasks.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            Nenhuma tarefa para este dia.
          </div>
        )}

        {/* Lista de tarefas */}
        {!isLoading && error === null && tasks.length > 0 && (
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-start gap-3"
              >
                {/* Horário */}
                <div className="w-12 shrink-0 text-xs text-gray-400 pt-0.5">
                  {task.time ?? '—'}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium text-gray-900 truncate ${
                      task.status === 'done' ? 'line-through text-gray-400' : ''
                    }`}
                  >
                    {task.name}
                  </p>

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {task.duration && (
                      <span className="text-xs text-gray-400">
                        {task.duration}min
                      </span>
                    )}
                    {task.category && (
                      <span className="text-xs text-gray-400">{task.category}</span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${PRIORIDADE_COR[task.priority]}`}
                    >
                      {task.priority}
                    </span>
                  </div>
                </div>

                {/* Status + delete */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleStatus(task)}
                    className={`text-xs px-2 py-1 rounded-full transition-colors ${STATUS_COR[task.status]}`}
                  >
                    {STATUS_LABEL[task.status]}
                  </button>

                  <button
                    onClick={() => void deleteTask(task.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-sm"
                    aria-label="Deletar tarefa"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
