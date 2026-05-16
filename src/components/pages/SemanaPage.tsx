'use client'

import { useState, type FormEvent } from 'react'
import { useEvents } from '@/hooks/useEvents'
import { useTasks } from '@/hooks/useTasks'
import type { CalendarEvent, EventCategory, CreateEventInput } from '@/types/event'

const DIAS_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

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

function hoje(): string {
  return new Date().toISOString().split('T')[0]
}

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

function formatarDia(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-PT', {
    day: 'numeric', month: 'short',
  })
}

function formatarIntervaloSemana(domStr: string, sabStr: string): string {
  const fmt = (s: string) => {
    const [year, month, day] = s.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('pt-PT', {
      day: 'numeric', month: 'short',
    })
  }
  return `${fmt(domStr)} – ${fmt(sabStr)}`
}

interface FormState {
  name: string
  date: string
  startTime: string
  endTime: string
  category: EventCategory
  notes: string
}

export default function SemanaPage() {
  const hojeStr = hoje()
  const [semanaAtual, setSemanaAtual] = useState(domingoSemana(hojeStr))
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState<FormState>({
    name: '', date: hojeStr, startTime: '', endTime: '', category: 'pers', notes: '',
  })

  const dias = diasDaSemana(semanaAtual)
  const sabado = dias[6]

  const { events: eventos, createEvent, deleteEvent } = useEvents(semanaAtual, sabado)
  const { tasks: tarefasHoje } = useTasks(hojeStr)

  function navegarSemana(delta: number) {
    setSemanaAtual((s) => adicionarDias(s, delta * 7))
  }

  function eventosDoDia(dateStr: string): CalendarEvent[] {
    return eventos.filter((e) => e.date.startsWith(dateStr))
  }

  function abrirNovoEvento(dateStr: string) {
    setForm((f) => ({ ...f, date: dateStr }))
    setMostrarForm(true)
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

  return (
    <div className="overflow-y-auto h-full" style={{ background: 'var(--ana-bg)' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navegarSemana(-1)}
              className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
            >
              ←
            </button>
            <span className="text-sm font-medium text-gray-700">
              {formatarIntervaloSemana(semanaAtual, sabado)}
            </span>
            <button
              onClick={() => navegarSemana(1)}
              className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
            >
              →
            </button>
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

        {/* Colunas dos dias */}
        <div className="grid grid-cols-7 gap-2">
          {dias.map((dateStr, i) => {
            const isHoje = dateStr === hojeStr
            const evs = eventosDoDia(dateStr)
            const [, , day] = dateStr.split('-')

            return (
              <div key={dateStr} className="flex flex-col">
                {/* Cabeçalho da coluna */}
                <div
                  className={`text-center pb-2 mb-2 border-b ${
                    isHoje ? 'border-gray-900' : 'border-gray-200'
                  }`}
                >
                  <div className="text-xs text-gray-400">{DIAS_ABREV[i]}</div>
                  <div
                    className={`text-sm font-semibold inline-flex w-7 h-7 items-center justify-center rounded-full mx-auto ${
                      isHoje ? 'bg-gray-900 text-white' : 'text-gray-700'
                    }`}
                  >
                    {parseInt(day)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{formatarDia(dateStr)}</div>
                </div>

                {/* Eventos do dia */}
                <div className="flex-1 space-y-1.5 min-h-32">
                  {evs.map((ev) => (
                    <div
                      key={ev.id}
                      className={`rounded-lg border p-2 text-xs ${CATEGORIA_COR[ev.category]}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-medium truncate">{ev.name}</span>
                        <button
                          onClick={() => void deleteEvent(ev.id)}
                          className="opacity-40 hover:opacity-100 shrink-0"
                          aria-label="Apagar"
                        >
                          ✕
                        </button>
                      </div>
                      {ev.startTime && (
                        <div className="opacity-70 mt-0.5">
                          {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Tarefas de hoje sobrepostas na coluna de hoje */}
                  {isHoje && tarefasHoje.filter(t => t.status !== 'done').map((t) => (
                    <div
                      key={t.id}
                      className={`rounded-lg bg-gray-50 border border-gray-200 p-2 text-xs text-gray-600 ${PRIORIDADE_COR[t.priority]}`}
                    >
                      <span className="truncate block">{t.name}</span>
                      {t.time && (
                        <span className="opacity-60 mt-0.5 block">{t.time}</span>
                      )}
                    </div>
                  ))}

                  {/* Botão de adicionar */}
                  <button
                    onClick={() => abrirNovoEvento(dateStr)}
                    className="w-full text-xs text-gray-300 hover:text-gray-500 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Modal de criação */}
        {mostrarForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Novo evento</h2>
                <button
                  onClick={() => setMostrarForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
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
      </div>
    </div>
  )
}
