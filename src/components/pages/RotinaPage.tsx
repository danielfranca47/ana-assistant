'use client'

import { useState, useEffect, useCallback, type FormEvent, type CSSProperties } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTasks } from '@/hooks/useTasks'
import { tasksApi } from '@/services/tasks'
import type { Task, TaskPriority, TaskStatus, UpdateTaskInput } from '@/types/task'
import EditPopover from '@/components/EditPopover'

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

function diasAtraso(dateStr: string): number {
  const hojeDate = new Date()
  hojeDate.setHours(0, 0, 0, 0)
  const [y, m, d] = dateStr.split('-').map(Number)
  const data = new Date(y, m - 1, d)
  data.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((hojeDate.getTime() - data.getTime()) / 86400000))
}

function descricaoAtraso(task: Task): string {
  const dias = diasAtraso(task.date)
  const hora = task.time ? `, ${task.time}` : ''
  if (dias === 0) return `prevista para hoje${hora}`
  if (dias === 1) return `prevista para ontem${hora}`
  return `prevista há ${dias} dias${hora}`
}

function proximaHoraLivre(tarefasHoje: Task[]): string {
  const agora = new Date()
  let hora = agora.getHours() + 1
  const horasOcupadas = new Set(
    tarefasHoje
      .filter((t) => t.time)
      .map((t) => parseInt(t.time!.split(':')[0], 10)),
  )
  while (hora < 24) {
    if (!horasOcupadas.has(hora)) return `${hora.toString().padStart(2, '0')}:00`
    hora++
  }
  return '23:00'
}

function minutosParaHora(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function recalcularHorarios(tasks: Task[]): Array<{ id: string; time: string | null }> {
  const anchorIdx = tasks.findIndex((t) => t.time !== null)
  if (anchorIdx === -1) return tasks.map((t) => ({ id: t.id, time: t.time }))

  const [h, m] = tasks[anchorIdx].time!.split(':').map(Number)
  let minutos = h * 60 + m

  return tasks.map((task, i) => {
    if (i < anchorIdx) return { id: task.id, time: task.time }
    const novaHora = minutosParaHora(minutos)
    minutos += task.duration ?? 0
    return { id: task.id, time: novaHora }
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

type Filtro = 'todas' | 'pending' | 'done' | 'alta' | 'trabalho' | 'pessoal'

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'done', label: 'Concluídas' },
  { id: 'alta', label: 'Alta prioridade' },
  { id: 'trabalho', label: 'Trabalho' },
  { id: 'pessoal', label: 'Pessoal' },
]

interface FormState {
  name: string
  time: string
  duration: string
  priority: TaskPriority
  category: string
  description: string
}

const FORM_INICIAL: FormState = {
  name: '',
  time: '',
  duration: '',
  priority: 'media',
  category: '',
  description: '',
}

function aplicarFiltros(tasks: Task[], filtros: Set<Filtro>): Task[] {
  if (filtros.has('todas') || filtros.size === 0) return tasks

  const statusFiltros = Array.from(filtros).filter((f) =>
    (['pending', 'done'] as string[]).includes(f),
  ) as TaskStatus[]
  const prioridadeFiltros = Array.from(filtros).filter((f) => f === 'alta')
  const categoriaFiltros = Array.from(filtros).filter((f) =>
    ['trabalho', 'pessoal'].includes(f),
  )

  return tasks.filter((task) => {
    const statusOk =
      statusFiltros.length === 0 || statusFiltros.includes(task.status as TaskStatus)
    const prioridadeOk =
      prioridadeFiltros.length === 0 || task.priority === 'alta'
    const categoriaOk =
      categoriaFiltros.length === 0 ||
      categoriaFiltros.includes((task.category?.toLowerCase() ?? '') as Filtro)
    return statusOk && prioridadeOk && categoriaOk
  })
}

// ---------------------------------------------------------------------------
// SortableTaskItem
// ---------------------------------------------------------------------------

interface SortableTaskItemProps {
  task: Task
  dragOverId: string | null
  expandidos: Set<string>
  onToggleConcluido: (task: Task) => void
  onToggleExpandido: (id: string) => void
  onToggleStatus: (task: Task) => void
  onEdit: (task: Task, e: React.MouseEvent) => void
  onDelete: (id: string) => void
}

function SortableTaskItem({
  task,
  dragOverId,
  expandidos,
  onToggleConcluido,
  onToggleExpandido,
  onToggleStatus,
  onEdit,
  onDelete,
}: SortableTaskItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isDropTarget = dragOverId === task.id && !isDragging

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group relative bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-start gap-3 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {/* Indicador de inserção */}
      {isDropTarget && (
        <span
          className="absolute inset-x-0 top-0 h-0.5 rounded-full"
          style={{ background: 'var(--ana-accent)' }}
        />
      )}

      {/* Handle de arrasto */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 mt-0.5 text-gray-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity select-none"
        aria-label="Arrastar para reordenar"
        tabIndex={-1}
      >
        ⠿
      </button>

      {/* Checkbox de conclusão */}
      <button
        onClick={() => onToggleConcluido(task)}
        className={`shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          task.status === 'done'
            ? 'bg-gray-900 border-gray-900 text-white'
            : 'border-gray-300 hover:border-gray-500'
        }`}
        aria-label={task.status === 'done' ? 'Marcar como pendente' : 'Marcar como concluída'}
      >
        {task.status === 'done' && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

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
            <span className="text-xs text-gray-400">{task.duration}min</span>
          )}
          {task.category && (
            <span className="text-xs text-gray-400">{task.category}</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORIDADE_COR[task.priority]}`}>
            {task.priority}
          </span>
          {task.description && (
            <button
              onClick={() => onToggleExpandido(task.id)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={expandidos.has(task.id) ? 'Recolher descrição' : 'Ver descrição'}
            >
              {expandidos.has(task.id) ? '▴' : '▾'}
            </button>
          )}
        </div>

        {expandidos.has(task.id) && task.description && (
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">{task.description}</p>
        )}
      </div>

      {/* Status + acções */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={(e) => onEdit(task, e)}
          className="text-gray-300 hover:text-gray-600 transition-colors text-sm"
          aria-label="Editar tarefa"
        >
          ✎
        </button>
        <button
          onClick={() => onToggleStatus(task)}
          className={`text-xs px-2 py-1 rounded-full transition-colors ${STATUS_COR[task.status]}`}
        >
          {STATUS_LABEL[task.status]}
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="text-gray-300 hover:text-red-400 transition-colors text-sm"
          aria-label="Deletar tarefa"
        >
          ✕
        </button>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// RotinaPage
// ---------------------------------------------------------------------------

export default function RotinaPage() {
  const [dataSelecionada, setDataSelecionada] = useState(hoje())
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [editTarget, setEditTarget] = useState<{ item: Task; position: { x: number; y: number } } | null>(null)

  // Filtros
  const [filtrosAtivos, setFiltrosAtivos] = useState<Set<Filtro>>(new Set<Filtro>(['todas']))

  // Tarefas em atraso
  const [tarefasAtrasadas, setTarefasAtrasadas] = useState<Task[]>([])
  const [secaoAtrasadasAberta, setSecaoAtrasadasAberta] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Drag & drop
  const [tarefasOrdenadas, setTarefasOrdenadas] = useState<Task[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const { tasks, isLoading, error, isMutating, createTask, updateTask, deleteTask } =
    useTasks(dataSelecionada)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const carregarAtrasadas = useCallback(async () => {
    await tasksApi.marcarAtrasadas()
    const res = await tasksApi.listarAtrasadas()
    if (res.data) setTarefasAtrasadas(res.data.tasks)
  }, [])

  useEffect(() => {
    void carregarAtrasadas()
    const intervalo = setInterval(() => void carregarAtrasadas(), 5 * 60 * 1000)
    return () => clearInterval(intervalo)
  }, [carregarAtrasadas])

  const tarefasFiltradas = aplicarFiltros(tasks, filtrosAtivos)

  // Sincroniza lista ordenada com a lista filtrada (excepto durante arrasto)
  useEffect(() => {
    if (!activeId) {
      setTarefasOrdenadas(tarefasFiltradas)
    }
  }, [tarefasFiltradas, activeId])

  function toggleFiltro(filtro: Filtro) {
    setFiltrosAtivos((prev) => {
      const next = new Set<Filtro>(prev)
      if (filtro === 'todas') {
        return new Set<Filtro>(['todas'])
      }
      next.delete('todas')
      if (next.has(filtro)) {
        next.delete(filtro)
        if (next.size === 0) return new Set<Filtro>(['todas'])
      } else {
        next.add(filtro)
      }
      return next
    })
  }

  function abrirEdit(task: Task, e: React.MouseEvent) {
    e.stopPropagation()
    setEditTarget({ item: task, position: { x: e.clientX, y: e.clientY } })
  }

  async function handleCriar(e: FormEvent) {
    e.preventDefault()
    await createTask({
      name: form.name,
      date: dataSelecionada,
      time: form.time || undefined,
      duration: form.duration ? Number(form.duration) : undefined,
      priority: form.priority,
      category: form.category || undefined,
      description: form.description || undefined,
    })
    setForm(FORM_INICIAL)
    setMostrarForm(false)
  }

  function toggleStatus(task: Task) {
    void updateTask(task.id, { status: PROXIMO_STATUS[task.status] })
  }

  function toggleConcluido(task: Task) {
    const novoStatus = task.status === 'done' ? 'pending' : 'done'
    void updateTask(task.id, { status: novoStatus })
  }

  function toggleExpandido(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function reagendarParaHoje(task: Task) {
    const horaLivre = proximaHoraLivre(tasks)
    const res = await tasksApi.atualizar(task.id, {
      date: hoje(),
      time: horaLivre,
      status: 'pending',
    })
    if (!res.error) {
      setTarefasAtrasadas((prev) => prev.filter((t) => t.id !== task.id))
    }
  }

  async function concluirAtrasada(task: Task) {
    const res = await tasksApi.atualizar(task.id, { status: 'done' })
    if (!res.error) {
      setTarefasAtrasadas((prev) => prev.filter((t) => t.id !== task.id))
    }
  }

  async function deletarAtrasada(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    const res = await tasksApi.deletar(id)
    if (!res.error) {
      setTarefasAtrasadas((prev) => prev.filter((t) => t.id !== id))
    }
    setConfirmDeleteId(null)
  }

  // Drag handlers

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragOver(event: DragOverEvent) {
    setDragOverId(event.over ? String(event.over.id) : null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    setDragOverId(null)

    if (!over || active.id === over.id) return

    const oldIdx = tarefasOrdenadas.findIndex((t) => t.id === String(active.id))
    const newIdx = tarefasOrdenadas.findIndex((t) => t.id === String(over.id))
    if (oldIdx === -1 || newIdx === -1) return

    const novaOrdem = arrayMove(tarefasOrdenadas, oldIdx, newIdx)
    const horarios = recalcularHorarios(novaOrdem)

    // Actualiza estado local com nova ordem e horários calculados
    const novaOrdemComHoras = novaOrdem.map((task) => {
      const h = horarios.find((x) => x.id === task.id)
      return h ? { ...task, time: h.time } : task
    })
    setTarefasOrdenadas(novaOrdemComHoras)

    // Persiste apenas tarefas cujo time efectivamente mudou
    const alteradas = horarios.filter(({ id, time }) => {
      const original = tarefasOrdenadas.find((t) => t.id === id)
      return original && original.time !== time
    })

    if (alteradas.length > 0) {
      await Promise.all(
        alteradas.map(({ id, time }) => updateTask(id, { time: time ?? undefined })),
      )
    }
  }

  return (
    <div className="overflow-y-auto h-full" style={{ background: 'var(--ana-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Secção de tarefas em atraso */}
        {tarefasAtrasadas.length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setSecaoAtrasadasAberta((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
            >
              <span>⚠️ Em atraso ({tarefasAtrasadas.length})</span>
              <span className="text-xs text-red-400">{secaoAtrasadasAberta ? '▴' : '▾'}</span>
            </button>

            {secaoAtrasadasAberta && (
              <ul className="divide-y divide-red-100">
                {tarefasAtrasadas.map((task) => {
                  const dias = diasAtraso(task.date)
                  const emConfirmacao = confirmDeleteId === task.id
                  return (
                    <li key={task.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{task.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{descricaoAtraso(task)}</p>
                      </div>

                      {dias > 0 && (
                        <span className="shrink-0 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          {dias} {dias === 1 ? 'dia' : 'dias'}
                        </span>
                      )}

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => void reagendarParaHoje(task)}
                          className="text-xs bg-gray-900 text-white px-2 py-1 rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap"
                        >
                          Reagendar
                        </button>
                        <button
                          onClick={() => void concluirAtrasada(task)}
                          className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200 transition-colors"
                        >
                          Concluída
                        </button>
                        <button
                          onClick={() => void deletarAtrasada(task.id)}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                            emConfirmacao
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'text-gray-400 hover:text-red-500'
                          }`}
                        >
                          {emConfirmacao ? 'Confirmar?' : '✕'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

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

        {/* Filtros rápidos */}
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => toggleFiltro(f.id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filtrosAtivos.has(f.id)
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Cabeçalho com botão e contador */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">Rotina</h1>
            {!isLoading && tasks.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {tarefasOrdenadas.length} {tarefasOrdenadas.length === 1 ? 'tarefa' : 'tarefas'}
              </span>
            )}
          </div>
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
                <label className="block text-xs text-gray-500 mb-1">Duração (min)</label>
                <input
                  type="number"
                  min={1}
                  placeholder="30"
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
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
                    setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))
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
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Descrição</label>
              <textarea
                placeholder="Detalhes da tarefa (opcional)"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 resize-none"
              />
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
            {[1, 2, 3].map((i) => (
              <li
                key={i}
                className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-start gap-3 animate-pulse"
              >
                <div className="w-5 h-5 rounded border-2 border-gray-200 shrink-0 mt-0.5" />
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
          <div className="text-center py-12 text-red-500 text-sm">{error}</div>
        )}

        {/* Lista vazia */}
        {!isLoading && error === null && tarefasOrdenadas.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            {tasks.length === 0
              ? 'Nenhuma tarefa para este dia.'
              : 'Nenhuma tarefa corresponde aos filtros activos.'}
          </div>
        )}

        {/* Lista de tarefas com drag & drop */}
        {!isLoading && error === null && tarefasOrdenadas.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tarefasOrdenadas.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {tarefasOrdenadas.map((task) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    dragOverId={dragOverId}
                    expandidos={expandidos}
                    onToggleConcluido={toggleConcluido}
                    onToggleExpandido={toggleExpandido}
                    onToggleStatus={toggleStatus}
                    onEdit={abrirEdit}
                    onDelete={(id) => void deleteTask(id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {editTarget && (
        <EditPopover
          item={editTarget.item}
          type="task"
          position={editTarget.position}
          onSave={async (dados) => updateTask(editTarget.item.id, dados as UpdateTaskInput)}
          onDelete={async () => deleteTask(editTarget.item.id)}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  )
}
