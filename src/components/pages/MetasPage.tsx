'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from '@/lib/apiFetch'

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const DIA_NUMS    = [1, 2, 3, 4, 5, 6, 0] // índice de DIAS_SEMANA → número do dia (0=Dom)

interface Prefs {
  workStart:     string
  workEnd:       string
  lunchStart:    string
  lunchEnd:      string
  focusTime:     string
  offDays:       string
}

interface Goal {
  id:           string
  name:         string
  targetValue:  number
  currentValue: number
  unit:         string
  weekStartDate: string
}

const PREFS_DEFAULT: Prefs = {
  workStart:  '08:00',
  workEnd:    '18:00',
  lunchStart: '12:00',
  lunchEnd:   '13:00',
  focusTime:  'morning',
  offDays:    '6,0',
}

function offDaysParaNomes(offDays: string): string[] {
  const nums = offDays.split(',').map((n) => n.trim()).filter(Boolean)
  return DIAS_SEMANA.filter((_, i) => nums.includes(String(DIA_NUMS[i])))
}

function nomesParaOffDays(nomes: string[]): string {
  return DIAS_SEMANA
    .map((nome, i) => (nomes.includes(nome) ? String(DIA_NUMS[i]) : null))
    .filter(Boolean)
    .join(',')
}

function focusParaNomes(focusTime: string): string[] {
  const parts = focusTime.split(',')
  const r: string[] = []
  if (parts.includes('morning'))   r.push('Manhã')
  if (parts.includes('afternoon')) r.push('Tarde')
  return r
}

function nomesParaFocus(nomes: string[]): string {
  const parts: string[] = []
  if (nomes.includes('Manhã')) parts.push('morning')
  if (nomes.includes('Tarde')) parts.push('afternoon')
  return parts.join(',') || 'morning'
}

const cardStyle: React.CSSProperties = {
  background:   'var(--ana-surface)',
  border:       '0.5px solid var(--ana-border)',
  borderRadius: 'var(--ana-radius)',
  padding:      18,
}

const cardTitleStyle: React.CSSProperties = {
  fontFamily:  'var(--font-cormorant), serif',
  fontSize:    15,
  fontWeight:  600,
  color:       'var(--ana-text)',
  marginBottom: 14,
  display:     'flex',
  alignItems:  'center',
  gap:         7,
}

const rowStyle: React.CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'space-between',
  padding:        '7px 0',
  borderBottom:   '0.5px solid var(--ana-border)',
  fontSize:       12,
}

const labelStyle: React.CSSProperties = { color: 'var(--ana-muted)' }
const valStyle:   React.CSSProperties = { color: 'var(--ana-text)', fontWeight: 500 }

function Toggle({ options, active, onChange }: {
  options:  string[]
  active:   string[]
  onChange: (opt: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const isActive = active.includes(opt)
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding:     '3px 8px',
              borderRadius: 4,
              fontSize:    11,
              border:      `0.5px solid ${isActive ? 'var(--ana-accent)' : 'var(--ana-border)'}`,
              background:  isActive ? 'var(--ana-accent)' : 'transparent',
              color:       isActive ? 'white' : 'var(--ana-muted)',
              cursor:      'pointer',
              fontFamily:  'var(--font-dm-sans), sans-serif',
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

const timeInputStyle: React.CSSProperties = {
  background:   'transparent',
  border:       '0.5px solid var(--ana-border)',
  borderRadius: 4,
  padding:      '2px 6px',
  fontSize:     12,
  color:        'var(--ana-text)',
  fontFamily:   'var(--font-dm-sans), sans-serif',
  width:        90,
}

const inputStyle: React.CSSProperties = {
  background:   'transparent',
  border:       '0.5px solid var(--ana-border)',
  borderRadius: 4,
  padding:      '4px 8px',
  fontSize:     12,
  color:        'var(--ana-text)',
  fontFamily:   'var(--font-dm-sans), sans-serif',
  outline:      'none',
  width:        '100%',
  boxSizing:    'border-box',
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div style={{
      height:       5,
      background:   'var(--ana-border)',
      borderRadius: 3,
      overflow:     'hidden',
      flex:         1,
    }}>
      <div style={{
        width:        `${clamped}%`,
        height:       '100%',
        background:   clamped >= 100 ? 'var(--ana-success, #4ade80)' : 'var(--ana-accent)',
        borderRadius: 3,
        transition:   'width 0.3s ease',
      }} />
    </div>
  )
}

function GoalItem({
  goal,
  onDelete,
  onIncrement,
}: {
  goal:        Goal
  onDelete:    (id: string) => void
  onIncrement: (id: string, value: number) => void
}) {
  const [showInput, setShowInput]     = useState(false)
  const [inputVal,  setInputVal]      = useState('')
  const [confirmar, setConfirmar]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pct = goal.targetValue > 0
    ? Math.round((goal.currentValue / goal.targetValue) * 100)
    : 0

  function handleIncrementSubmit() {
    const delta = parseFloat(inputVal.replace(',', '.'))
    if (isNaN(delta) || delta <= 0) return
    onIncrement(goal.id, goal.currentValue + delta)
    setShowInput(false)
    setInputVal('')
  }

  useEffect(() => {
    if (showInput) inputRef.current?.focus()
  }, [showInput])

  return (
    <div style={{ padding: '10px 0', borderBottom: '0.5px solid var(--ana-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--ana-text)', flex: 1, fontWeight: 500 }}>
          {goal.name}
        </span>
        <span style={{ fontSize: 11, color: 'var(--ana-muted)', whiteSpace: 'nowrap' }}>
          {pct}% — {goal.currentValue}{goal.unit} de {goal.targetValue}{goal.unit}
        </span>
        <button
          title="Incrementar progresso"
          onClick={() => setShowInput((v) => !v)}
          style={{
            width:        20,
            height:       20,
            borderRadius: '50%',
            border:       '0.5px solid var(--ana-border)',
            background:   'transparent',
            color:        'var(--ana-accent)',
            cursor:       'pointer',
            fontSize:     14,
            lineHeight:   '1',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            flexShrink:   0,
          }}
        >+</button>
        {confirmar ? (
          <button
            title="Confirmar eliminação"
            onClick={() => onDelete(goal.id)}
            style={{
              width:        20,
              height:       20,
              borderRadius: '50%',
              border:       '0.5px solid #ef4444',
              background:   '#ef444420',
              color:        '#ef4444',
              cursor:       'pointer',
              fontSize:     11,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              flexShrink:   0,
            }}
          >✓</button>
        ) : (
          <button
            title="Apagar meta"
            onClick={() => setConfirmar(true)}
            onBlur={() => setTimeout(() => setConfirmar(false), 200)}
            style={{
              width:        20,
              height:       20,
              borderRadius: '50%',
              border:       '0.5px solid var(--ana-border)',
              background:   'transparent',
              color:        'var(--ana-muted)',
              cursor:       'pointer',
              fontSize:     13,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              flexShrink:   0,
            }}
          >×</button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ProgressBar pct={pct} />
        <span style={{ fontSize: 10, color: pct >= 100 ? 'var(--ana-success, #4ade80)' : 'var(--ana-accent)', fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
          {pct}%
        </span>
      </div>

      {showInput && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="number"
            step="0.1"
            min="0"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleIncrementSubmit(); if (e.key === 'Escape') setShowInput(false) }}
            placeholder={`Adicionar (${goal.unit})`}
            style={{ ...inputStyle, width: 140 }}
          />
          <button
            onClick={handleIncrementSubmit}
            style={{
              padding:      '4px 10px',
              borderRadius: 4,
              border:       '0.5px solid var(--ana-accent)',
              background:   'var(--ana-accent)',
              color:        'white',
              fontSize:     11,
              cursor:       'pointer',
              fontFamily:   'var(--font-dm-sans), sans-serif',
              whiteSpace:   'nowrap',
            }}
          >Guardar</button>
          <button
            onClick={() => { setShowInput(false); setInputVal('') }}
            style={{
              padding:      '4px 8px',
              borderRadius: 4,
              border:       '0.5px solid var(--ana-border)',
              background:   'transparent',
              color:        'var(--ana-muted)',
              fontSize:     11,
              cursor:       'pointer',
              fontFamily:   'var(--font-dm-sans), sans-serif',
            }}
          >Cancelar</button>
        </div>
      )}
    </div>
  )
}

function GoalsCard() {
  const [goals,         setGoals]         = useState<Goal[]>([])
  const [carregando,    setCarregando]    = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [formName,      setFormName]      = useState('')
  const [formTarget,    setFormTarget]    = useState('')
  const [formUnit,      setFormUnit]      = useState('')
  const [guardando,     setGuardando]     = useState(false)

  useEffect(() => {
    apiFetch.get<Goal[]>('/api/goals').then((res) => {
      if (res.data) setGoals(res.data)
    }).finally(() => setCarregando(false))
  }, [])

  async function handleDelete(id: string) {
    await apiFetch.delete(`/api/goals/${id}`)
    setGoals((prev) => prev.filter((g) => g.id !== id))
  }

  async function handleIncrement(id: string, newValue: number) {
    const res = await apiFetch.patch<Goal>(`/api/goals/${id}`, { currentValue: newValue })
    if (res.data) {
      setGoals((prev) => prev.map((g) => g.id === id ? res.data! : g))
    }
  }

  async function handleCreate() {
    const target = parseFloat(formTarget.replace(',', '.'))
    if (!formName.trim() || isNaN(target) || target <= 0 || !formUnit.trim()) return
    setGuardando(true)
    const res = await apiFetch.post<Goal>('/api/goals', {
      name:        formName.trim(),
      targetValue: target,
      unit:        formUnit.trim(),
    })
    if (res.data) {
      setGoals((prev) => [...prev, res.data!])
      setFormName('')
      setFormTarget('')
      setFormUnit('')
      setShowForm(false)
    }
    setGuardando(false)
  }

  return (
    <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
      <h3 style={{ ...cardTitleStyle, marginBottom: 8 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ana-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="16 12 12 8 8 12" />
          <line x1="12" y1="16" x2="12" y2="8" />
        </svg>
        Metas semanais
        <span style={{ fontSize: 11, color: 'var(--ana-muted)', fontFamily: 'var(--font-dm-sans), sans-serif', fontWeight: 400, marginLeft: 'auto' }}>
          Reiniciam toda a segunda-feira
        </span>
      </h3>

      {carregando ? (
        <span style={{ fontSize: 12, color: 'var(--ana-muted)' }}>A carregar metas...</span>
      ) : goals.length === 0 && !showForm ? (
        <p style={{ fontSize: 12, color: 'var(--ana-muted)', margin: '8px 0' }}>
          Nenhuma meta definida. Adiciona a primeira abaixo.
        </p>
      ) : (
        <div>
          {goals.map((g) => (
            <GoalItem
              key={g.id}
              goal={g}
              onDelete={handleDelete}
              onIncrement={handleIncrement}
            />
          ))}
        </div>
      )}

      {showForm && (
        <div style={{
          marginTop:    12,
          padding:      12,
          background:   'var(--ana-bg)',
          borderRadius: 'var(--ana-radius)',
          border:       '0.5px solid var(--ana-border)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Nome (ex: Horas de foco por semana)"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              style={inputStyle}
            />
            <input
              type="number"
              placeholder="Alvo"
              step="0.1"
              min="0"
              value={formTarget}
              onChange={(e) => setFormTarget(e.target.value)}
              style={{ ...inputStyle, width: 80 }}
            />
            <input
              type="text"
              placeholder="Unidade"
              value={formUnit}
              onChange={(e) => setFormUnit(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              style={{ ...inputStyle, width: 90 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleCreate}
              disabled={guardando}
              style={{
                padding:      '4px 14px',
                borderRadius: 4,
                border:       '0.5px solid var(--ana-accent)',
                background:   'var(--ana-accent)',
                color:        'white',
                fontSize:     11,
                cursor:       'pointer',
                fontFamily:   'var(--font-dm-sans), sans-serif',
                opacity:      guardando ? 0.6 : 1,
              }}
            >{guardando ? 'A guardar...' : 'Guardar'}</button>
            <button
              onClick={() => { setShowForm(false); setFormName(''); setFormTarget(''); setFormUnit('') }}
              style={{
                padding:      '4px 10px',
                borderRadius: 4,
                border:       '0.5px solid var(--ana-border)',
                background:   'transparent',
                color:        'var(--ana-muted)',
                fontSize:     11,
                cursor:       'pointer',
                fontFamily:   'var(--font-dm-sans), sans-serif',
              }}
            >Cancelar</button>
          </div>
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            marginTop:    10,
            padding:      '5px 12px',
            borderRadius: 4,
            border:       '0.5px solid var(--ana-border)',
            background:   'transparent',
            color:        'var(--ana-accent)',
            fontSize:     11,
            cursor:       'pointer',
            fontFamily:   'var(--font-dm-sans), sans-serif',
            display:      'flex',
            alignItems:   'center',
            gap:          4,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Adicionar meta
        </button>
      )}
    </div>
  )
}

export default function MetasPage() {
  const [prefs, setPrefs]         = useState<Prefs>(PREFS_DEFAULT)
  const [carregando, setCarregando] = useState(true)
  const [guardado, setGuardado]   = useState(false)
  const [notificacoes, setNotificacoes] = useState(['Activas'])
  const [checkIn, setCheckIn]           = useState(['Sex tarde'])

  const saveTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const guardadoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    apiFetch.get<Prefs>('/api/preferences').then((resPrefs) => {
      if (resPrefs.data) {
        setPrefs({
          workStart:  resPrefs.data.workStart,
          workEnd:    resPrefs.data.workEnd,
          lunchStart: resPrefs.data.lunchStart,
          lunchEnd:   resPrefs.data.lunchEnd,
          focusTime:  resPrefs.data.focusTime,
          offDays:    resPrefs.data.offDays,
        })
      }
    }).finally(() => setCarregando(false))
  }, [])

  const agendarGuardar = useCallback((delta: Partial<Prefs>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const res = await apiFetch.patch('/api/preferences', delta)
      if (res.data !== null) {
        if (guardadoTimerRef.current) clearTimeout(guardadoTimerRef.current)
        setGuardado(true)
        guardadoTimerRef.current = setTimeout(() => setGuardado(false), 2000)
      }
    }, 800)
  }, [])

  function alterarPrefs(delta: Partial<Prefs>) {
    const novo = { ...prefs, ...delta }
    setPrefs(novo)
    agendarGuardar(delta)
  }

  function toggleDia(opt: string) {
    const nomes = offDaysParaNomes(prefs.offDays)
    const novosNomes = nomes.includes(opt) ? nomes.filter((x) => x !== opt) : [...nomes, opt]
    alterarPrefs({ offDays: nomesParaOffDays(novosNomes) })
  }

  function toggleFoco(opt: string) {
    const nomes = focusParaNomes(prefs.focusTime)
    const novosNomes = nomes.includes(opt) ? nomes.filter((x) => x !== opt) : [...nomes, opt]
    alterarPrefs({ focusTime: nomesParaFocus(novosNomes) })
  }

  function toggleLocal(current: string[], opt: string): string[] {
    return current.includes(opt) ? current.filter((x) => x !== opt) : [...current, opt]
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: 'var(--ana-bg)' }}>
        <span style={{ color: 'var(--ana-muted)', fontSize: 13 }}>A carregar preferências...</span>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full" style={{ background: 'var(--ana-bg)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 24px' }}>

        {/* Banner "Guardado" */}
        {guardado && (
          <div style={{
            display:        'flex',
            alignItems:     'center',
            gap:            6,
            background:     'var(--ana-surface)',
            border:         '0.5px solid var(--ana-accent)',
            borderRadius:   'var(--ana-radius)',
            padding:        '6px 12px',
            marginBottom:   12,
            fontSize:       12,
            color:          'var(--ana-accent)',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Guardado
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Card: Metas semanais — full width */}
          <GoalsCard />

          {/* Card: Preferências de horário */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ana-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Preferências de horário
            </h3>
            <div style={rowStyle}>
              <span style={labelStyle}>Início do trabalho</span>
              <input
                type="time"
                value={prefs.workStart}
                onChange={(e) => alterarPrefs({ workStart: e.target.value })}
                style={timeInputStyle}
              />
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Fim do trabalho</span>
              <input
                type="time"
                value={prefs.workEnd}
                onChange={(e) => alterarPrefs({ workEnd: e.target.value })}
                style={timeInputStyle}
              />
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Início almoço</span>
              <input
                type="time"
                value={prefs.lunchStart}
                onChange={(e) => alterarPrefs({ lunchStart: e.target.value })}
                style={timeInputStyle}
              />
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Fim almoço</span>
              <input
                type="time"
                value={prefs.lunchEnd}
                onChange={(e) => alterarPrefs({ lunchEnd: e.target.value })}
                style={timeInputStyle}
              />
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Dias de folga</span>
              <Toggle
                options={DIAS_SEMANA}
                active={offDaysParaNomes(prefs.offDays)}
                onChange={toggleDia}
              />
            </div>
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <span style={labelStyle}>Foco profundo</span>
              <Toggle
                options={['Manhã', 'Tarde']}
                active={focusParaNomes(prefs.focusTime)}
                onChange={toggleFoco}
              />
            </div>
          </div>

          {/* Card: Estilo de trabalho */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ana-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              Estilo de trabalho
            </h3>
            <div style={rowStyle}>
              <span style={labelStyle}>Reuniões seguidas (máx.)</span>
              <span style={valStyle}>2 por dia</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Pausa entre reuniões</span>
              <span style={valStyle}>15 min</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Tarefas por bloco</span>
              <span style={valStyle}>1 por vez</span>
            </div>
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <span style={labelStyle}>Notificações</span>
              <Toggle
                options={['Activas', 'Silencioso']}
                active={notificacoes}
                onChange={(opt) => setNotificacoes([opt])}
              />
            </div>
          </div>

          {/* Card: Bem-estar */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ana-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              Bem-estar
            </h3>
            <div style={rowStyle}>
              <span style={labelStyle}>Pausa de descanso</span>
              <span style={valStyle}>5 min / hora</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Exercício físico</span>
              <span style={valStyle}>30 min / dia</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Horas de sono alvo</span>
              <span style={valStyle}>7h30</span>
            </div>
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <span style={labelStyle}>Check-in semanal</span>
              <Toggle
                options={['Sex tarde']}
                active={checkIn}
                onChange={(opt) => setCheckIn(toggleLocal(checkIn, opt))}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
