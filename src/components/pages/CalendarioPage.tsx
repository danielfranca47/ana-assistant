'use client'

import { useState, type FormEvent } from 'react'
import { useEventsQuery, useCreateEvent, useDeleteEvent } from '@/hooks/useEvents'
import type { CalendarEvent, EventCategory, CreateEventInput } from '@/types/event'

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

const CATEGORIA_LABEL: Record<EventCategory, string> = {
  work: 'Trabalho', meet: 'Reunião', pers: 'Pessoal', break: 'Pausa',
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

interface FormState {
  name: string
  date: string
  startTime: string
  endTime: string
  category: EventCategory
  notes: string
}

export default function CalendarioPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState<FormState>({
    name: '', date: hoje(), startTime: '', endTime: '', category: 'pers', notes: '',
  })

  const from = primeiroDiaMes(year, month)
  const to = ultimoDiaMes(year, month)

  const { data: eventos } = useEventsQuery(from, to)
  const criarEvento = useCreateEvent()
  const deletarEvento = useDeleteEvent()

  const grade = gerarGrade(year, month)
  const hojeStr = hoje()

  function navegarMes(delta: number) {
    const novaData = new Date(year, month + delta, 1)
    setYear(novaData.getFullYear())
    setMonth(novaData.getMonth())
    setDataSelecionada(null)
  }

  function eventosDoDia(dateStr: string): CalendarEvent[] {
    return (eventos ?? []).filter((e) => e.date.startsWith(dateStr))
  }

  function abrirNovoEvento(dateStr?: string) {
    setForm((f) => ({ ...f, date: dateStr ?? hojeStr }))
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
    await criarEvento.mutateAsync(input)
    setForm({ name: '', date: hojeStr, startTime: '', endTime: '', category: 'pers', notes: '' })
    setMostrarForm(false)
  }

  const eventosDiaSelecionado = dataSelecionada ? eventosDoDia(dataSelecionada) : []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
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
          <div className="flex-1">
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
                const isHoje = dateStr === hojeStr
                const isSelecionado = dateStr === dataSelecionada

                return (
                  <div
                    key={dateStr}
                    onClick={() => setDataSelecionada(isSelecionado ? null : dateStr)}
                    className={`bg-white h-24 p-1.5 cursor-pointer transition-colors hover:bg-gray-50 ${
                      isSelecionado ? 'ring-2 ring-inset ring-gray-900' : ''
                    }`}
                  >
                    <span
                      className={`text-xs font-medium inline-flex w-6 h-6 items-center justify-center rounded-full ${
                        isHoje
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-700'
                      }`}
                    >
                      {dia.getDate()}
                    </span>

                    <div className="mt-0.5 space-y-0.5">
                      {evs.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          className={`text-xs px-1 py-0.5 rounded truncate ${CATEGORIA_COR[ev.category]}`}
                        >
                          {ev.name}
                        </div>
                      ))}
                      {evs.length > 2 && (
                        <div className="text-xs text-gray-400 px-1">
                          +{evs.length - 2} mais
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Painel lateral do dia selecionado */}
          {dataSelecionada && (
            <div className="w-64 shrink-0">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {new Date(dataSelecionada + 'T12:00:00').toLocaleDateString('pt-BR', {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}
                  </h2>
                  <button
                    onClick={() => abrirNovoEvento(dataSelecionada)}
                    className="text-xs text-gray-500 hover:text-gray-900"
                  >
                    + Novo
                  </button>
                </div>

                {eventosDiaSelecionado.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhum evento.</p>
                ) : (
                  <ul className="space-y-2">
                    {eventosDiaSelecionado.map((ev) => (
                      <li key={ev.id} className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{ev.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {ev.startTime && (
                              <span className="text-xs text-gray-400">{ev.startTime}</span>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${CATEGORIA_COR[ev.category]}`}>
                              {CATEGORIA_LABEL[ev.category]}
                            </span>
                          </div>
                          {ev.notes && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{ev.notes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => deletarEvento.mutate(ev.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors text-xs shrink-0"
                          aria-label="Deletar evento"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
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
                  disabled={criarEvento.isPending}
                  className="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {criarEvento.isPending ? 'Salvando...' : 'Salvar evento'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
