'use client'

import { useState, useRef, useMemo, type FormEvent } from 'react'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { useEvents } from '@/hooks/useEvents'
import { useTasksRange } from '@/hooks/useTasksRange'
import type { CalendarEvent, EventCategory, CreateEventInput, UpdateEventInput } from '@/types/event'
import EditPopover from '@/components/EditPopover'

const DIAS_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const HORA_INICIO = 6
const HORA_FIM = 23
const HORA_PX = 36
const MIN_DURACAO = 15

const CATEGORIA_COR: Record<EventCategory, string> = {
  work:  'bg-blue-100 text-blue-700 border-blue-200',
  meet:  'bg-purple-100 text-purple-700 border-purple-200',
  pers:  'bg-green-100 text-green-700 border-green-200',
  break: 'bg-orange-100 text-orange-700 border-orange-200',
}

const PRIORIDADE_COR: Record<string, string> = {
  alta:  'border-l-2 border-red-400',
  media: 'border-l-2 border-yellow-400',
  baixa: 'border-l-2 border-gray-300',
}

function hoje(): string { return new Date().toISOString().split('T')[0] }

function domingoSemana(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() - d.getDay())
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function adicionarDias(dateStr: string, dias: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function diasDaSemana(domingoStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => adicionarDias(domingoStr, i))
}

function formatarIntervaloSemana(domStr: string, sabStr: string): string {
  const fmt = (s: string) => {
    const [year, month, day] = s.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
  }
  return `${fmt(domStr)} – ${fmt(sabStr)}`
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function snapTo15(minutes: number): number {
  return Math.round(minutes / 15) * 15
}

function topPx(time: string): number {
  return Math.max(0, (timeToMinutes(time) - HORA_INICIO * 60) / 60 * HORA_PX)
}

function heightPx(startTime: string, endTime: string | null): number {
  if (!endTime) return HORA_PX
  const dur = timeToMinutes(endTime) - timeToMinutes(startTime)
  return Math.max(MIN_DURACAO / 60 * HORA_PX, dur / 60 * HORA_PX)
}

function detectarConflito(
  events: CalendarEvent[],
  excludeId: string,
  date: string,
  startTime: string,
  endTime: string,
): CalendarEvent | null {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  return events.find((e) => {
    if (e.id === excludeId || !e.startTime || !e.endTime) return false
    if (!e.date.startsWith(date)) return false
    return timeToMinutes(e.startTime) < end && timeToMinutes(e.endTime) > start
  }) ?? null
}

// --- CelulaDroppable ---

interface CelulaProps {
  id: string
  topOffset: number
  isOver: boolean
  hasConflict: boolean
  onClick: () => void
}

function CelulaDroppable({ id, topOffset, isOver, hasConflict, onClick }: CelulaProps) {
  const { setNodeRef } = useDroppable({ id })
  let bg = 'transparent'
  if (isOver && hasConflict) bg = 'rgba(254, 202, 202, 0.7)'
  else if (isOver) bg = 'rgba(187, 247, 208, 0.7)'
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{
        position: 'absolute',
        top: topOffset,
        left: 0,
        right: 0,
        height: HORA_PX,
        background: bg,
        borderBottom: '1px solid rgb(243 244 246)',
        transition: 'background 0.1s',
        cursor: 'default',
      }}
    />
  )
}

// --- EventoGrelha ---

interface EventoGrelhaProps {
  ev: CalendarEvent
  isDragging: boolean
  onEdit: (ev: CalendarEvent, e: React.MouseEvent) => void
  onDelete: (id: string) => void
  onResizeEnd: (id: string, novoEndTime: string) => void
}

function EventoGrelha({ ev, isDragging, onEdit, onDelete, onResizeEnd }: EventoGrelhaProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: ev.id })
  const [alturaLocal, setAlturaLocal] = useState<number | null>(null)
  const resizeRef = useRef<{ startY: number; startEndMins: number } | null>(null)

  if (!ev.startTime) return null

  const top = topPx(ev.startTime)
  const height = alturaLocal ?? heightPx(ev.startTime, ev.endTime)

  function handleResizeDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const endMins = ev.endTime ? timeToMinutes(ev.endTime) : timeToMinutes(ev.startTime!) + 60
    resizeRef.current = { startY: e.clientY, startEndMins: endMins }

    function onMove(me: MouseEvent) {
      if (!resizeRef.current || !ev.startTime) return
      const deltaMins = ((me.clientY - resizeRef.current.startY) / HORA_PX) * 60
      const snapped = snapTo15(resizeRef.current.startEndMins + deltaMins)
      const startMins = timeToMinutes(ev.startTime)
      const clampedEnd = Math.max(startMins + MIN_DURACAO, Math.min(snapped, 24 * 60))
      setAlturaLocal((clampedEnd - startMins) / 60 * HORA_PX)
    }

    function onUp(me: MouseEvent) {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!resizeRef.current || !ev.startTime) { setAlturaLocal(null); return }
      const deltaMins = ((me.clientY - resizeRef.current.startY) / HORA_PX) * 60
      const snapped = snapTo15(resizeRef.current.startEndMins + deltaMins)
      const startMins = timeToMinutes(ev.startTime)
      const clampedEnd = Math.max(startMins + MIN_DURACAO, Math.min(snapped, 24 * 60))
      resizeRef.current = null
      setAlturaLocal(null)
      onResizeEnd(ev.id, minutesToTime(clampedEnd))
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        position: 'absolute',
        top,
        left: 2,
        right: 2,
        height,
        opacity: isDragging ? 0.4 : 1,
        zIndex: 10,
        touchAction: 'none',
      }}
      className={`rounded border text-xs overflow-hidden select-none cursor-grab active:cursor-grabbing ${CATEGORIA_COR[ev.category]}`}
    >
      <div className="p-1 flex items-start justify-between gap-0.5 h-full overflow-hidden">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate leading-tight">{ev.name}</div>
          <div className="opacity-70 leading-tight">
            {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
          </div>
        </div>
        <div className="flex gap-0.5 shrink-0">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onEdit(ev, e) }}
            className="opacity-40 hover:opacity-100 leading-none"
            aria-label="Editar"
          >
            ✎
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(ev.id) }}
            className="opacity-40 hover:opacity-100 leading-none"
            aria-label="Apagar"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Borda de redimensionamento */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={handleResizeDown}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          cursor: 'ns-resize',
        }}
        className="hover:bg-green-400 transition-colors"
      />
    </div>
  )
}

// --- Formulário ---

interface FormState {
  name: string
  date: string
  startTime: string
  endTime: string
  category: EventCategory
  notes: string
}

// --- SemanaPage ---

export default function SemanaPage() {
  const hojeStr = hoje()
  const [semanaAtual, setSemanaAtual] = useState(domingoSemana(hojeStr))
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState<FormState>({
    name: '', date: hojeStr, startTime: '', endTime: '', category: 'pers', notes: '',
  })
  const [editTarget, setEditTarget] = useState<{ item: CalendarEvent; position: { x: number; y: number } } | null>(null)
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)
  const [overCelulaId, setOverCelulaId] = useState<string | null>(null)

  const dias = diasDaSemana(semanaAtual)
  const sabado = dias[6]
  const { events: eventos, createEvent, updateEvent, deleteEvent } = useEvents(semanaAtual, sabado)
  const { tasks: tarefasSemana } = useTasksRange(semanaAtual, sabado)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const horas = Array.from({ length: HORA_FIM - HORA_INICIO }, (_, i) => HORA_INICIO + i)
  const gridAltura = (HORA_FIM - HORA_INICIO) * HORA_PX

  function eventosDoDia(dateStr: string) {
    return eventos.filter((e) => e.date.startsWith(dateStr) && e.startTime)
  }

  function eventosAllDay(dateStr: string) {
    return eventos.filter((e) => e.date.startsWith(dateStr) && !e.startTime)
  }

  function tarefasDoDia(dateStr: string) {
    return tarefasSemana.filter((t) => t.status !== 'done' && t.date.startsWith(dateStr))
  }

  function abrirEdit(ev: CalendarEvent, e: React.MouseEvent) {
    e.stopPropagation()
    setEditTarget({ item: ev, position: { x: e.clientX, y: e.clientY } })
  }

  function abrirNovoEvento(dateStr: string, hora?: number) {
    setForm((f) => ({
      ...f,
      date: dateStr,
      startTime: hora !== undefined ? `${String(hora).padStart(2, '0')}:00` : '',
      endTime: hora !== undefined ? `${String(Math.min(hora + 1, 23)).padStart(2, '0')}:00` : '',
    }))
    setMostrarForm(true)
  }

  function handleDragStart(e: DragStartEvent) {
    setDragActiveId(String(e.active.id))
  }

  function handleDragOver(e: DragOverEvent) {
    setOverCelulaId(e.over ? String(e.over.id) : null)
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragActiveId(null)
    setOverCelulaId(null)
    if (!e.over) return

    const eventId = String(e.active.id)
    const celulaId = String(e.over.id)
    const ev = eventos.find((x) => x.id === eventId)
    if (!ev?.startTime) return

    const [novaDate, horaStr] = celulaId.split('/')
    const novaHora = parseInt(horaStr)
    const duracaoMins = ev.endTime
      ? timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime)
      : 60

    const novoStartMins = novaHora * 60
    const novoEndMins = Math.min(novoStartMins + duracaoMins, 24 * 60 - 1)
    const novoStartTime = minutesToTime(novoStartMins)
    const novoEndTime = minutesToTime(novoEndMins)
    const dadosNovos: UpdateEventInput = { date: novaDate, startTime: novoStartTime, endTime: novoEndTime }

    const conflito = detectarConflito(eventos, eventId, novaDate, novoStartTime, novoEndTime)
    if (conflito) {
      toast.warning(`Conflito com "${conflito.name}"`, {
        action: { label: 'Guardar mesmo assim', onClick: () => void updateEvent(eventId, dadosNovos) },
        duration: 8000,
      })
    } else {
      void updateEvent(eventId, dadosNovos)
    }
  }

  function handleResizeEnd(id: string, novoEndTime: string) {
    const ev = eventos.find((e) => e.id === id)
    if (!ev?.startTime) return
    const date = ev.date.split('T')[0]
    const conflito = detectarConflito(eventos, id, date, ev.startTime, novoEndTime)
    if (conflito) {
      toast.warning(`Conflito com "${conflito.name}"`, {
        action: { label: 'Guardar mesmo assim', onClick: () => void updateEvent(id, { endTime: novoEndTime }) },
        duration: 8000,
      })
    } else {
      void updateEvent(id, { endTime: novoEndTime })
    }
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
    }
    await createEvent(input)
    setForm({ name: '', date: hojeStr, startTime: '', endTime: '', category: 'pers', notes: '' })
    setMostrarForm(false)
  }

  const dragEvent = dragActiveId ? eventos.find((e) => e.id === dragActiveId) : null

  // Detecta conflito para a célula actualmente sob o cursor durante o drag
  const celulaHoverConflito = useMemo(() => {
    if (!overCelulaId || !dragActiveId) return false
    const ev = eventos.find((e) => e.id === dragActiveId)
    if (!ev?.startTime) return false
    const [novaDate, horaStr] = overCelulaId.split('/')
    const novaHora = parseInt(horaStr)
    const duracaoMins = ev.endTime ? timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime) : 60
    const novoStartMins = novaHora * 60
    const novoEndMins = Math.min(novoStartMins + duracaoMins, 24 * 60 - 1)
    return !!detectarConflito(eventos, dragActiveId, novaDate, minutesToTime(novoStartMins), minutesToTime(novoEndMins))
  }, [overCelulaId, dragActiveId, eventos])

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-y-auto h-full" style={{ background: 'var(--ana-bg)' }}>
        <div className="max-w-6xl mx-auto px-4 py-8">

          {/* Cabeçalho da semana */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSemanaAtual((s) => adicionarDias(s, -7))}
                className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
              >←</button>
              <span className="text-sm font-medium text-gray-700">
                {formatarIntervaloSemana(semanaAtual, sabado)}
              </span>
              <button
                onClick={() => setSemanaAtual((s) => adicionarDias(s, 7))}
                className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
              >→</button>
              {semanaAtual !== domingoSemana(hojeStr) && (
                <button
                  onClick={() => setSemanaAtual(domingoSemana(hojeStr))}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Esta semana
                </button>
              )}
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Semana</h1>
          </div>

          {/* Grelha de tempo */}
          <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">

            {/* Coluna de horas */}
            <div className="w-12 shrink-0 border-r border-gray-100">
              {/* Espaço para cabeçalho dos dias + zona all-day */}
              <div style={{ height: 64 + 32 }} />
              <div className="relative" style={{ height: gridAltura }}>
                {horas.map((h) => (
                  <div
                    key={h}
                    className="absolute text-xs text-gray-400 text-right pr-1.5"
                    style={{ top: (h - HORA_INICIO) * HORA_PX - 7, right: 0, width: '100%' }}
                  >
                    {String(h).padStart(2, '0')}h
                  </div>
                ))}
              </div>
            </div>

            {/* Colunas dos dias */}
            <div className="flex-1 grid grid-cols-7 divide-x divide-gray-100 min-w-0">
              {dias.map((dateStr, i) => {
                const isHoje = dateStr === hojeStr
                const [, , day] = dateStr.split('-')
                const evs = eventosDoDia(dateStr)
                const allDay = eventosAllDay(dateStr)
                const tarefas = tarefasDoDia(dateStr)

                return (
                  <div key={dateStr} className="flex flex-col min-w-0">

                    {/* Cabeçalho do dia */}
                    <div
                      className={`text-center py-2 border-b ${isHoje ? 'border-gray-900' : 'border-gray-100'}`}
                      style={{ height: 64 }}
                    >
                      <div className="text-xs text-gray-400 uppercase tracking-wide">{DIAS_ABREV[i]}</div>
                      <div
                        className={`text-sm font-semibold inline-flex w-7 h-7 items-center justify-center rounded-full mx-auto mt-0.5 ${
                          isHoje ? 'bg-gray-900 text-white' : 'text-gray-700'
                        }`}
                      >
                        {parseInt(day)}
                      </div>
                    </div>

                    {/* Zona all-day: eventos sem hora + tarefas */}
                    <div
                      className="border-b border-gray-100 px-0.5 py-0.5 space-y-0.5 overflow-hidden"
                      style={{ minHeight: 32 }}
                    >
                      {allDay.map((ev) => (
                        <div
                          key={ev.id}
                          className={`rounded text-xs px-1 truncate border ${CATEGORIA_COR[ev.category]}`}
                        >
                          {ev.name}
                        </div>
                      ))}
                      {tarefas.map((t) => (
                        <div
                          key={t.id}
                          className={`rounded text-xs px-1 truncate bg-gray-50 border border-gray-200 text-gray-600 ${PRIORIDADE_COR[t.priority]}`}
                        >
                          {t.name}
                        </div>
                      ))}
                      {allDay.length === 0 && tarefas.length === 0 && (
                        <button
                          onClick={() => abrirNovoEvento(dateStr)}
                          className="w-full text-xs text-gray-300 hover:text-gray-500 rounded hover:bg-gray-50 transition-colors leading-6"
                        >
                          +
                        </button>
                      )}
                    </div>

                    {/* Grelha de horas */}
                    <div className="relative flex-1" style={{ height: gridAltura }}>
                      {horas.map((h) => {
                        const cellId = `${dateStr}/${String(h).padStart(2, '0')}`
                        const isOver = cellId === overCelulaId
                        return (
                          <CelulaDroppable
                            key={cellId}
                            id={cellId}
                            topOffset={(h - HORA_INICIO) * HORA_PX}
                            isOver={isOver}
                            hasConflict={isOver && celulaHoverConflito}
                            onClick={() => abrirNovoEvento(dateStr, h)}
                          />
                        )
                      })}

                      {evs.map((ev) => (
                        <EventoGrelha
                          key={ev.id}
                          ev={ev}
                          isDragging={ev.id === dragActiveId}
                          onEdit={abrirEdit}
                          onDelete={(id) => void deleteEvent(id)}
                          onResizeEnd={handleResizeEnd}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Modal de criação */}
          {mostrarForm && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Novo evento</h2>
                  <button onClick={() => setMostrarForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
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

          {editTarget && (
            <EditPopover
              item={editTarget.item}
              type="event"
              position={editTarget.position}
              onSave={async (dados) => updateEvent(editTarget.item.id, dados as UpdateEventInput)}
              onDelete={async () => deleteEvent(editTarget.item.id)}
              onClose={() => setEditTarget(null)}
            />
          )}
        </div>
      </div>

      {/* Cartão fantasma que segue o cursor durante o drag */}
      <DragOverlay dropAnimation={null}>
        {dragEvent?.startTime ? (
          <div
            className={`rounded border text-xs p-1 shadow-lg pointer-events-none ${CATEGORIA_COR[dragEvent.category]}`}
            style={{ width: 120, opacity: 0.92 }}
          >
            <div className="font-medium truncate">{dragEvent.name}</div>
            <div className="opacity-70">{dragEvent.startTime}{dragEvent.endTime ? ` – ${dragEvent.endTime}` : ''}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
