'use client'

import { useState, type FormEvent } from 'react'
import { useEvents } from '@/hooks/useEvents'
import { useTasksRange } from '@/hooks/useTasksRange'
import { tasksApi } from '@/services/tasks'
import type { CalendarEvent, EventCategory, CreateEventInput, UpdateEventInput, RecurrenceScope } from '@/types/event'
import type { Task, TaskPriority, TaskStatus, UpdateTaskInput, CreateTaskInput } from '@/types/task'
import EditPopover from '@/components/EditPopover'
import RecurrenceFields from '@/components/RecurrenceFields'
import SlotSuggestionButton from '@/components/SlotSuggestionButton'

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const CATEGORIA_COR: Record<EventCategory, string> = {
  work:  'bg-blue-100 text-blue-700',
  meet:  'bg-purple-100 text-purple-700',
  pers:  'bg-green-100 text-green-700',
  break: 'bg-orange-100 text-orange-700',
}

const CATEGORIA_DOT: Record<EventCategory, string> = {
  work: 'bg-blue-500', meet: 'bg-purple-500', pers: 'bg-green-500', break: 'bg-orange-400',
}

const CATEGORIA_LABEL: Record<EventCategory, string> = {
  work: 'Trabalho', meet: 'Reunião', pers: 'Pessoal', break: 'Pausa',
}

const PRIORIDADE_DOT: Record<TaskPriority, string> = {
  alta: 'bg-red-400', media: 'bg-yellow-400', baixa: 'bg-gray-300',
}

function hoje(): string {
  return new Date().toISOString().split('T')[0]
}

function primeiroDiaMes(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`
}

function ultimoDiaMes(year: number, month: number): string {
  const ultimo = new Date(year, month + 1, 0).getDate()
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
}

function adicionarDias(dateStr: string, dias: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function gerarGrade(year: number, month: number): Array<Date | null> {
  const primeiroDia = new Date(year, month, 1).getDay()
  const ultimoDia = new Date(year, month + 1, 0).getDate()
  const grade: Array<Date | null> = Array(primeiroDia).fill(null)
  for (let d = 1; d <= ultimoDia; d++) grade.push(new Date(year, month, d))
  while (grade.length % 7 !== 0) grade.push(null)
  return grade
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatarDataCurta(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-PT', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function formatarDataLonga(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-PT', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

interface FormState {
  name: string
  date: string
  startTime: string
  endTime: string
  category: EventCategory
  notes: string
  recurrence: string
  recurrenceDays: number[]
  recurrenceEnd: string
}

type EditTarget = {
  item: CalendarEvent | Task
  type: 'event' | 'task'
  position: { x: number; y: number }
}

export default function CalendarioPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null)

  // Formulário de novo evento
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState<FormState>({
    name: '', date: hoje(), startTime: '', endTime: '', category: 'pers', notes: '',
    recurrence: '', recurrenceDays: [], recurrenceEnd: '',
  })

  // Edit popover (eventos e tarefas)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)

  // Mutações optimistas de tarefas
  const [taskOverrides, setTaskOverrides] =
    useState<Record<string, (Partial<Task> & { _deleted?: boolean }) | undefined>>({})
  // Tarefas criadas no day panel (não estão no hook de range)
  const [extraTasks, setExtraTasks] = useState<Task[]>([])

  // Remarcar inline
  const [rescheduleTarget, setRescheduleTarget] =
    useState<{ type: 'event' | 'task'; id: string } | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')

  // Formulário de nova tarefa no day panel
  const [mostrarFormTarefa, setMostrarFormTarefa] = useState(false)
  const [formTarefa, setFormTarefa] =
    useState<{ name: string; time: string; priority: TaskPriority }>
    ({ name: '', time: '', priority: 'media' })

  const from = primeiroDiaMes(year, month)
  const to = ultimoDiaMes(year, month)
  const hojeStr = hoje()
  const daqui30 = adicionarDias(hojeStr, 30)

  const { events: eventosDoMes, createEvent, updateEvent, deleteEvent } = useEvents(from, to)
  const { events: proxEventos, isLoading: carregandoProx } = useEvents(hojeStr, daqui30)
  const { tasks: tarefasDoMes } = useTasksRange(from, to)

  const grade = gerarGrade(year, month)

  function navegarMes(delta: number) {
    const novaData = new Date(year, month + delta, 1)
    setYear(novaData.getFullYear())
    setMonth(novaData.getMonth())
    setDataSelecionada(null)
    setExtraTasks([])
  }

  function selecionarDia(dateStr: string) {
    if (dataSelecionada === dateStr) {
      setDataSelecionada(null)
    } else {
      setDataSelecionada(dateStr)
      setExtraTasks([])
      setTaskOverrides({})
      setRescheduleTarget(null)
    }
  }

  function eventosDoDia(dateStr: string): CalendarEvent[] {
    return eventosDoMes.filter((e) => e.date.startsWith(dateStr))
  }

  function tarefasDoDia(dateStr: string): Task[] {
    return tarefasDoMes.filter((t) => t.status !== 'done' && t.date.startsWith(dateStr))
  }

  // Tarefas do day panel: inclui done, aplica overrides, inclui extra
  function tarefasDoDiaAll(dateStr: string): Task[] {
    const base = tarefasDoMes
      .filter((t) => t.date.startsWith(dateStr))
      .map((t) => {
        const ov = taskOverrides[t.id]
        if (!ov) return t
        return { ...t, ...ov }
      })
      .filter((t) => !taskOverrides[t.id]?._deleted)

    const extra = extraTasks.filter((t) => t.date.startsWith(dateStr))
    return [...base, ...extra]
  }

  function abrirNovoEvento(dateStr?: string) {
    setForm((f) => ({ ...f, date: dateStr ?? hojeStr }))
    setMostrarForm(true)
  }

  function abrirEdit(item: CalendarEvent, e: React.MouseEvent) {
    e.stopPropagation()
    setEditTarget({ item, type: 'event', position: { x: e.clientX, y: e.clientY } })
  }

  function abrirEditTask(task: Task, e: React.MouseEvent) {
    e.stopPropagation()
    setEditTarget({ item: task, type: 'task', position: { x: e.clientX, y: e.clientY } })
  }

  // Mutações de tarefas
  async function handleDeleteTask(id: string) {
    await tasksApi.deletar(id)
    setTaskOverrides((prev) => ({ ...prev, [id]: { _deleted: true } }))
    setExtraTasks((prev) => prev.filter((t) => t.id !== id))
  }

  async function handleToggleTask(id: string, status: TaskStatus) {
    const novoStatus: TaskStatus = status === 'done' ? 'pending' : 'done'
    await tasksApi.atualizar(id, { status: novoStatus })
    setTaskOverrides((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), status: novoStatus },
    }))
    setExtraTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: novoStatus } : t))
  }

  async function handleRescheduleTask(id: string, newDate: string) {
    if (!newDate) return
    await tasksApi.atualizar(id, { date: newDate })
    setTaskOverrides((prev) => ({ ...prev, [id]: { _deleted: true } }))
    setExtraTasks((prev) => prev.filter((t) => t.id !== id))
    setRescheduleTarget(null)
    setRescheduleDate('')
  }

  async function handleRescheduleEvent(ev: CalendarEvent, newDate: string) {
    if (!newDate) return
    await updateEvent(ev.id, { date: newDate })
    setRescheduleTarget(null)
    setRescheduleDate('')
  }

  async function handleCreateTask() {
    if (!formTarefa.name.trim() || !dataSelecionada) return
    const input: CreateTaskInput = {
      name: formTarefa.name.trim(),
      date: dataSelecionada,
      priority: formTarefa.priority,
      ...(formTarefa.time && { time: formTarefa.time }),
    }
    const res = await tasksApi.criar(input)
    if (res.data) {
      setExtraTasks((prev) => [...prev, res.data!])
    }
    setFormTarefa({ name: '', time: '', priority: 'media' })
    setMostrarFormTarefa(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const input: CreateEventInput = {
      name: form.name,
      date: form.date,
      category: form.category,
      ...(form.startTime && { startTime: form.startTime }),
      ...(form.endTime && { endTime: form.endTime }),
      ...(form.notes && { notes: form.notes }),
      ...(form.recurrence && {
        recurrence: form.recurrence,
        ...(form.recurrenceDays.length && { recurrenceDays: JSON.stringify(form.recurrenceDays) }),
        ...(form.recurrenceEnd && { recurrenceEnd: form.recurrenceEnd }),
      }),
    }
    await createEvent(input)
    setForm({ name: '', date: hojeStr, startTime: '', endTime: '', category: 'pers', notes: '', recurrence: '', recurrenceDays: [], recurrenceEnd: '' })
    setMostrarForm(false)
  }

  return (
    <div className="overflow-y-auto h-full" style={{ background: 'var(--ana-bg)' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navegarMes(-1)}
              className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
            >
              ←
            </button>
            <h1 className="text-xl font-semibold text-gray-900 w-48 text-center">
              {MESES[month]} {year}
            </h1>
            <button
              onClick={() => navegarMes(1)}
              className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
            >
              →
            </button>
            {(year !== now.getFullYear() || month !== now.getMonth()) && (
              <button
                onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Hoje
              </button>
            )}
          </div>
          <button
            onClick={() => abrirNovoEvento()}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            + Novo evento
          </button>
        </div>

        <div className="flex gap-4">
          {/* Grade do calendário */}
          <div className="flex-1 min-w-0">
            {/* Cabeçalho dos dias */}
            <div className="grid grid-cols-7 mb-1">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Células */}
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
              {grade.map((dia, i) => {
                if (!dia) return <div key={i} className="bg-gray-50 h-24" />

                const dateStr = toDateStr(dia)
                const evs = eventosDoDia(dateStr)
                const tfs = tarefasDoDia(dateStr)
                const isHoje = dateStr === hojeStr
                const isSelecionado = dateStr === dataSelecionada

                return (
                  <div
                    key={dateStr}
                    onClick={() => selecionarDia(dateStr)}
                    className={`bg-white h-24 p-1.5 cursor-pointer transition-colors hover:bg-gray-50 ${
                      isSelecionado ? 'ring-2 ring-inset ring-gray-900 bg-gray-50' : ''
                    }`}
                  >
                    <span
                      className={`text-xs font-medium inline-flex w-6 h-6 items-center justify-center rounded-full ${
                        isHoje ? 'bg-gray-900 text-white' : 'text-gray-700'
                      }`}
                    >
                      {dia.getDate()}
                    </span>

                    <div className="mt-0.5 space-y-0.5">
                      {evs.slice(0, 2).map((ev) => (
                        <div key={ev.id} className={`text-xs px-1 py-0.5 rounded truncate ${CATEGORIA_COR[ev.category]}`}>
                          {ev.name}
                        </div>
                      ))}
                      {tfs.slice(0, Math.max(0, 2 - evs.length)).map((t) => (
                        <div key={t.id} className="text-xs px-1 py-0.5 rounded truncate bg-gray-100 text-gray-600">
                          {t.name}
                        </div>
                      ))}
                      {evs.length + tfs.length > 2 && (
                        <div className="text-xs text-gray-400 px-1">
                          +{evs.length + tfs.length - 2} mais
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sidebar direita */}
          <div className={`shrink-0 space-y-4 transition-all ${dataSelecionada ? 'w-80' : 'w-64'}`}>

            {/* Day Panel — quando um dia está selecionado */}
            {dataSelecionada && (() => {
              const evsDia = eventosDoDia(dataSelecionada)
              const tfsDia = tarefasDoDiaAll(dataSelecionada)
              const semItens = evsDia.length === 0 && tfsDia.length === 0

              return (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Cabeçalho do day panel */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <span className="text-sm font-semibold text-gray-900 capitalize">
                      {formatarDataLonga(dataSelecionada)}
                    </span>
                    <button
                      onClick={() => setDataSelecionada(null)}
                      className="text-gray-400 hover:text-gray-700 text-base leading-none"
                      aria-label="Fechar"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Botões de acção */}
                  <div className="flex gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50">
                    <button
                      onClick={() => abrirNovoEvento(dataSelecionada)}
                      className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
                    >
                      + Evento
                    </button>
                    <button
                      onClick={() => { setMostrarFormTarefa(true); setFormTarefa({ name: '', time: '', priority: 'media' }) }}
                      className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
                    >
                      + Tarefa
                    </button>
                  </div>

                  {/* Formulário de nova tarefa inline */}
                  {mostrarFormTarefa && (
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 space-y-2">
                      <p className="text-xs font-medium text-gray-700">Nova tarefa</p>
                      <input
                        type="text"
                        autoFocus
                        placeholder="Nome da tarefa"
                        value={formTarefa.name}
                        onChange={(e) => setFormTarefa((f) => ({ ...f, name: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateTask(); if (e.key === 'Escape') setMostrarFormTarefa(false) }}
                        className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                      <div className="flex gap-2">
                        <input
                          type="time"
                          value={formTarefa.time}
                          onChange={(e) => setFormTarefa((f) => ({ ...f, time: e.target.value }))}
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
                        />
                        <select
                          value={formTarefa.priority}
                          onChange={(e) => setFormTarefa((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
                        >
                          <option value="alta">Alta</option>
                          <option value="media">Média</option>
                          <option value="baixa">Baixa</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleCreateTask()}
                          className="flex-1 text-xs bg-gray-900 text-white py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setMostrarFormTarefa(false)}
                          className="flex-1 text-xs border border-gray-200 py-1.5 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="overflow-y-auto max-h-[calc(100vh-260px)]">
                    {semItens ? (
                      <p className="text-xs text-gray-400 px-4 py-4 text-center">
                        Nenhuma actividade neste dia.
                      </p>
                    ) : (
                      <>
                        {/* Eventos */}
                        {evsDia.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-3 pb-1">
                              Eventos
                            </p>
                            <ul className="divide-y divide-gray-50">
                              {evsDia.map((ev) => {
                                const isRemarcar = rescheduleTarget?.type === 'event' && rescheduleTarget.id === ev.id
                                return (
                                  <li key={ev.id} className="px-4 py-2.5">
                                    <div className="flex items-start gap-2">
                                      <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${CATEGORIA_DOT[ev.category]}`} />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-900 font-medium truncate">{ev.name}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                          {ev.startTime && (
                                            <span className="text-xs text-gray-500">
                                              {ev.startTime}{ev.endTime ? `–${ev.endTime}` : ''}
                                            </span>
                                          )}
                                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${CATEGORIA_COR[ev.category]}`}>
                                            {CATEGORIA_LABEL[ev.category]}
                                          </span>
                                        </div>
                                        {ev.notes && (
                                          <p className="text-xs text-gray-400 mt-0.5 truncate">{ev.notes}</p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={(e) => abrirEdit(ev, e)}
                                          title="Editar"
                                          className="text-gray-300 hover:text-gray-600 transition-colors text-sm"
                                        >
                                          ✎
                                        </button>
                                        <button
                                          onClick={() => {
                                            setRescheduleTarget(isRemarcar ? null : { type: 'event', id: ev.id })
                                            setRescheduleDate(ev.date.split('T')[0])
                                          }}
                                          title="Remarcar"
                                          className={`text-xs px-1.5 py-0.5 rounded transition-colors border ${
                                            isRemarcar
                                              ? 'border-gray-400 text-gray-700 bg-gray-100'
                                              : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-400'
                                          }`}
                                        >
                                          →
                                        </button>
                                        <button
                                          onClick={() => void deleteEvent(ev.id)}
                                          title="Apagar"
                                          className="text-gray-300 hover:text-red-400 transition-colors text-sm"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>

                                    {/* Picker de remarcar */}
                                    {isRemarcar && (
                                      <div className="mt-2 flex items-center gap-2 pl-4">
                                        <input
                                          type="date"
                                          value={rescheduleDate}
                                          onChange={(e) => setRescheduleDate(e.target.value)}
                                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
                                        />
                                        <button
                                          onClick={() => void handleRescheduleEvent(ev, rescheduleDate)}
                                          disabled={!rescheduleDate}
                                          className="text-xs bg-gray-900 text-white px-2 py-1 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40"
                                        >
                                          Confirmar
                                        </button>
                                        <button
                                          onClick={() => setRescheduleTarget(null)}
                                          className="text-xs text-gray-400 hover:text-gray-600"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    )}
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        )}

                        {/* Tarefas */}
                        {tfsDia.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-3 pb-1">
                              Tarefas
                            </p>
                            <ul className="divide-y divide-gray-50">
                              {tfsDia.map((task) => {
                                const isDone = task.status === 'done'
                                const isRemarcar = rescheduleTarget?.type === 'task' && rescheduleTarget.id === task.id
                                return (
                                  <li key={task.id} className="px-4 py-2.5">
                                    <div className="flex items-start gap-2">
                                      {/* Checkbox */}
                                      <button
                                        onClick={() => void handleToggleTask(task.id, task.status)}
                                        title={isDone ? 'Marcar como pendente' : 'Marcar como concluída'}
                                        className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                                          isDone
                                            ? 'bg-gray-900 border-gray-900 text-white'
                                            : 'border-gray-300 hover:border-gray-500'
                                        }`}
                                      >
                                        {isDone && <span className="text-xs leading-none">✓</span>}
                                      </button>

                                      <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium truncate ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                          {task.name}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                          {task.time && (
                                            <span className="text-xs text-gray-500">{task.time}</span>
                                          )}
                                          <span className="flex items-center gap-1 text-xs text-gray-500">
                                            <span className={`w-1.5 h-1.5 rounded-full ${PRIORIDADE_DOT[task.priority]}`} />
                                            {task.priority === 'alta' ? 'Alta' : task.priority === 'media' ? 'Média' : 'Baixa'}
                                          </span>
                                          {task.category && (
                                            <span className="text-xs text-gray-400">{task.category}</span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={(e) => abrirEditTask(task, e)}
                                          title="Editar"
                                          className="text-gray-300 hover:text-gray-600 transition-colors text-sm"
                                        >
                                          ✎
                                        </button>
                                        <button
                                          onClick={() => {
                                            setRescheduleTarget(isRemarcar ? null : { type: 'task', id: task.id })
                                            setRescheduleDate(task.date.split('T')[0])
                                          }}
                                          title="Remarcar"
                                          className={`text-xs px-1.5 py-0.5 rounded transition-colors border ${
                                            isRemarcar
                                              ? 'border-gray-400 text-gray-700 bg-gray-100'
                                              : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-400'
                                          }`}
                                        >
                                          →
                                        </button>
                                        <button
                                          onClick={() => void handleDeleteTask(task.id)}
                                          title="Apagar"
                                          className="text-gray-300 hover:text-red-400 transition-colors text-sm"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>

                                    {/* Picker de remarcar */}
                                    {isRemarcar && (
                                      <div className="mt-2 flex items-center gap-2 pl-6">
                                        <input
                                          type="date"
                                          value={rescheduleDate}
                                          onChange={(e) => setRescheduleDate(e.target.value)}
                                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
                                        />
                                        <button
                                          onClick={() => void handleRescheduleTask(task.id, rescheduleDate)}
                                          disabled={!rescheduleDate}
                                          className="text-xs bg-gray-900 text-white px-2 py-1 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40"
                                        >
                                          Confirmar
                                        </button>
                                        <button
                                          onClick={() => setRescheduleTarget(null)}
                                          className="text-xs text-gray-400 hover:text-gray-600"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    )}
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Próximos eventos */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Próximos eventos</h2>
              {carregandoProx ? (
                <p className="text-xs text-gray-400">A carregar...</p>
              ) : proxEventos.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhum evento nos próximos 30 dias.</p>
              ) : (
                <ul className="space-y-2">
                  {proxEventos.slice(0, 6).map((ev) => (
                    <li key={ev.id} className="flex items-start gap-2">
                      <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${CATEGORIA_DOT[ev.category]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{ev.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs text-gray-400">
                            {formatarDataCurta(ev.date.split('T')[0])}
                          </span>
                          {ev.startTime && (
                            <span className="text-xs text-gray-400">· {ev.startTime}</span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Modal de criação de evento */}
        {mostrarForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Novo evento</h2>
                <button onClick={() => setMostrarForm(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Nome do evento"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                />

                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Início</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Fim</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                    />
                  </div>
                </div>

                {!form.startTime && !form.endTime && (
                  <SlotSuggestionButton
                    taskName={form.name}
                    duration={60}
                    priority="media"
                    date={form.date}
                    onAccept={(st, et) => setForm((f) => ({ ...f, startTime: st, endTime: et }))}
                  />
                )}

                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as EventCategory }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                >
                  <option value="work">Trabalho</option>
                  <option value="meet">Reunião</option>
                  <option value="pers">Pessoal</option>
                  <option value="break">Pausa</option>
                </select>

                <RecurrenceFields
                  recurrence={form.recurrence}
                  recurrenceDays={form.recurrenceDays}
                  recurrenceEnd={form.recurrenceEnd}
                  onChange={(field, value) => setForm((f) => ({ ...f, [field]: value }))}
                />

                <textarea
                  placeholder="Notas (opcional)"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 resize-none"
                />

                <button
                  type="submit"
                  className="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  Guardar evento
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Edit popover (eventos e tarefas) */}
        {editTarget && (
          <EditPopover
            item={editTarget.item}
            type={editTarget.type}
            position={editTarget.position}
            onSave={async (dados, scope) => {
              if (editTarget.type === 'task') {
                const res = await tasksApi.atualizar(editTarget.item.id, dados as UpdateTaskInput)
                if (res.data) {
                  setTaskOverrides((prev) => ({
                    ...prev,
                    [editTarget.item.id]: { ...(prev[editTarget.item.id] ?? {}), ...dados },
                  }))
                  setExtraTasks((prev) =>
                    prev.map((t) => t.id === editTarget.item.id ? { ...t, ...(dados as Partial<Task>) } : t)
                  )
                }
              } else {
                await updateEvent(
                  editTarget.item.id,
                  dados as UpdateEventInput,
                  scope as RecurrenceScope | undefined,
                )
              }
            }}
            onDelete={async (scope) => {
              if (editTarget.type === 'task') {
                await handleDeleteTask(editTarget.item.id)
              } else {
                await deleteEvent(editTarget.item.id, scope as RecurrenceScope | undefined)
              }
            }}
            onClose={() => setEditTarget(null)}
          />
        )}
      </div>
    </div>
  )
}
