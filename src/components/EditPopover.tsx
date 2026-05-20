'use client'

import { useState, useEffect, useRef } from 'react'
import type { Task, TaskPriority, UpdateTaskInput } from '@/types/task'
import type { CalendarEvent, EventCategory, UpdateEventInput } from '@/types/event'

interface EditPopoverProps {
  item: Task | CalendarEvent
  type: 'task' | 'event'
  position: { x: number; y: number }
  onSave: (dados: UpdateTaskInput | UpdateEventInput) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}

type TaskFormState = {
  name: string
  date: string
  category: string
  time: string
  duration: string
  priority: TaskPriority
  description: string
  mostrarNotas: boolean
}

type EventFormState = {
  name: string
  date: string
  category: EventCategory
  startTime: string
  endTime: string
  notes: string
  mostrarNotas: boolean
}

const DURACOES = [15, 30, 45, 60, 90, 120]

const CATEGORIA_EVENTO_LABEL: Record<EventCategory, string> = {
  work: 'Trabalho',
  meet: 'Reunião',
  pers: 'Pessoal',
  break: 'Pausa',
}

const PRIORIDADE_COR: Record<TaskPriority, string> = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-yellow-100 text-yellow-700',
  baixa: 'bg-green-100 text-green-700',
}

function initForm(item: Task | CalendarEvent, type: 'task' | 'event'): TaskFormState | EventFormState {
  if (type === 'task') {
    const t = item as Task
    return {
      name: t.name,
      date: t.date.split('T')[0],
      category: t.category ?? '',
      time: t.time ?? '',
      duration: t.duration ? String(t.duration) : '',
      priority: t.priority,
      description: t.description ?? '',
      mostrarNotas: Boolean(t.description),
    }
  } else {
    const ev = item as CalendarEvent
    return {
      name: ev.name,
      date: ev.date.split('T')[0],
      category: ev.category,
      startTime: ev.startTime ?? '',
      endTime: ev.endTime ?? '',
      notes: ev.notes ?? '',
      mostrarNotas: Boolean(ev.notes),
    }
  }
}

export default function EditPopover({ item, type, position, onSave, onDelete, onClose }: EditPopoverProps) {
  const [form, setForm] = useState<TaskFormState | EventFormState>(() => initForm(item, type))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const POPOVER_WIDTH = 280
  const posX = position.x > window.innerWidth / 2
    ? position.x - POPOVER_WIDTH
    : position.x
  const posY = Math.min(position.y, window.innerHeight - 440)

  function setField(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaveError(null)
    try {
      if (type === 'task') {
        const f = form as TaskFormState
        await onSave({
          name: f.name || undefined,
          category: f.category || undefined,
          time: f.time || undefined,
          duration: f.duration ? Number(f.duration) : undefined,
          priority: f.priority,
          description: f.description || undefined,
        } as UpdateTaskInput)
      } else {
        const f = form as EventFormState
        await onSave({
          name: f.name || undefined,
          date: f.date || undefined,
          category: f.category as EventCategory,
          startTime: f.startTime || undefined,
          endTime: f.endTime || undefined,
          notes: f.notes || undefined,
        } as UpdateEventInput)
      }
      onClose()
    } catch {
      setSaveError('Erro ao guardar')
    }
  }

  const isTask = type === 'task'
  const taskForm = form as TaskFormState
  const eventForm = form as EventFormState

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        left: posX,
        top: posY,
        width: POPOVER_WIDTH,
        zIndex: 1000,
        background: 'var(--ana-surface, white)',
        border: '1px solid var(--ana-border, rgba(0,0,0,0.08))',
        borderRadius: 'var(--ana-radius, 12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        padding: 16,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-800">
          {isTask ? 'Editar tarefa' : 'Editar evento'}
        </span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 transition-colors text-base leading-none"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2.5">
        {/* Nome */}
        <input
          type="text"
          value={form.name}
          onChange={e => setField('name', e.target.value)}
          autoFocus
          placeholder="Nome"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
        />

        {/* Data — task: texto estático / event: input */}
        {isTask ? (
          <p className="text-xs text-gray-400">
            Data: {taskForm.date}
          </p>
        ) : (
          <input
            type="date"
            value={eventForm.date}
            onChange={e => setField('date', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        )}

        {/* Hora(s) + duração */}
        {isTask ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">Hora</label>
              <input
                type="time"
                value={taskForm.time}
                onChange={e => setField('time', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">Duração</label>
              <select
                value={taskForm.duration}
                onChange={e => setField('duration', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                <option value="">—</option>
                {DURACOES.map(d => (
                  <option key={d} value={String(d)}>{d} min</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">Início</label>
              <input
                type="time"
                value={eventForm.startTime}
                onChange={e => setField('startTime', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">Fim</label>
              <input
                type="time"
                value={eventForm.endTime}
                onChange={e => setField('endTime', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>
          </div>
        )}

        {/* Categoria */}
        {isTask ? (
          <input
            type="text"
            value={taskForm.category}
            onChange={e => setField('category', e.target.value)}
            placeholder="Categoria (ex: trabalho)"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        ) : (
          <select
            value={eventForm.category}
            onChange={e => setField('category', e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            {(Object.keys(CATEGORIA_EVENTO_LABEL) as EventCategory[]).map(cat => (
              <option key={cat} value={cat}>{CATEGORIA_EVENTO_LABEL[cat]}</option>
            ))}
          </select>
        )}

        {/* Prioridade — apenas tarefas */}
        {isTask && (
          <div className="flex gap-1.5">
            {(['alta', 'media', 'baixa'] as TaskPriority[]).map(p => (
              <button
                key={p}
                onClick={() => setField('priority', p)}
                className={`flex-1 text-xs px-2 py-1 rounded-full transition-colors capitalize border ${
                  taskForm.priority === p
                    ? PRIORIDADE_COR[p] + ' border-transparent font-medium'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                }`}
              >
                {p === 'media' ? 'Média' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Toggle notas */}
        <button
          onClick={() => setField('mostrarNotas', !form.mostrarNotas)}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {form.mostrarNotas ? '– Notas' : '+ Notas'}
        </button>

        {form.mostrarNotas && (
          <textarea
            value={isTask ? taskForm.description : eventForm.notes}
            onChange={e => setField(isTask ? 'description' : 'notes', e.target.value)}
            placeholder="Notas..."
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
          />
        )}

        {/* Erro inline */}
        {saveError && (
          <p className="text-xs text-red-500">{saveError}</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Apagar
          </button>
        ) : (
          <span className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">Apagar?</span>
            <button
              onClick={() => void onDelete().then(onClose)}
              className="text-red-500 hover:text-red-700 font-medium"
            >
              Sim
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              Não
            </button>
          </span>
        )}

        <button
          onClick={() => void handleSave()}
          className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}
