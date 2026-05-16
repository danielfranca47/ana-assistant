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

interface Meta {
  id:        string
  name:      string
  targetPct: number
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

export default function MetasPage() {
  const [prefs, setPrefs]         = useState<Prefs>(PREFS_DEFAULT)
  const [metas, setMetas]         = useState<Meta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [guardado, setGuardado]   = useState(false)
  const [novaMetaNome, setNovaMetaNome] = useState('')
  const [adicionando, setAdicionando]   = useState(false)
  const [notificacoes, setNotificacoes] = useState(['Activas'])
  const [checkIn, setCheckIn]           = useState(['Sex tarde'])

  const saveTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const guardadoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    Promise.all([
      apiFetch.get<Prefs>('/api/preferences'),
      apiFetch.get<Meta[]>('/api/goals'),
    ]).then(([resPrefs, resMetas]) => {
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
      if (resMetas.data) setMetas(resMetas.data)
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

  async function adicionarMeta() {
    const nome = novaMetaNome.trim()
    if (!nome) return
    setAdicionando(true)
    const res = await apiFetch.post<Meta>('/api/goals', { name: nome, targetPct: 0 })
    if (res.data) {
      setMetas((prev) => [...prev, res.data!])
      setNovaMetaNome('')
    }
    setAdicionando(false)
  }

  async function actualizarPct(id: string, pct: number) {
    const val = Math.max(0, Math.min(100, pct))
    setMetas((prev) => prev.map((m) => (m.id === id ? { ...m, targetPct: val } : m)))
    await apiFetch.patch(`/api/goals/${id}`, { targetPct: val })
  }

  async function removerMeta(id: string) {
    setMetas((prev) => prev.filter((m) => m.id !== id))
    await apiFetch.delete(`/api/goals/${id}`)
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

          {/* Card: Metas semanais */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ana-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
              Metas semanais
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {metas.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--ana-muted)', textAlign: 'center', padding: '12px 0' }}>
                  Sem metas. Adicione abaixo.
                </p>
              )}
              {metas.map((meta) => (
                <div key={meta.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--ana-text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {meta.name}
                  </span>
                  <div style={{ width: 60, height: 5, background: 'var(--ana-border)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ width: `${meta.targetPct}%`, height: '100%', background: 'var(--ana-accent)', borderRadius: 3 }} />
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={meta.targetPct}
                    onChange={(e) => actualizarPct(meta.id, Number(e.target.value))}
                    style={{
                      width:        42,
                      fontSize:     11,
                      color:        'var(--ana-muted)',
                      background:   'transparent',
                      border:       '0.5px solid var(--ana-border)',
                      borderRadius: 4,
                      padding:      '1px 4px',
                      textAlign:    'right',
                      flexShrink:   0,
                      fontFamily:   'var(--font-dm-sans), sans-serif',
                    }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--ana-muted)', flexShrink: 0 }}>%</span>
                  <button
                    onClick={() => removerMeta(meta.id)}
                    title="Remover meta"
                    style={{
                      background: 'none',
                      border:     'none',
                      cursor:     'pointer',
                      color:      'var(--ana-muted)',
                      padding:    '2px',
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Input inline para nova meta */}
            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              <input
                type="text"
                placeholder="Nome da meta..."
                value={novaMetaNome}
                onChange={(e) => setNovaMetaNome(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') adicionarMeta() }}
                style={{
                  flex:         1,
                  fontSize:     12,
                  background:   'transparent',
                  border:       '0.5px solid var(--ana-border)',
                  borderRadius: 6,
                  padding:      '5px 8px',
                  color:        'var(--ana-text)',
                  fontFamily:   'var(--font-dm-sans), sans-serif',
                  outline:      'none',
                }}
              />
              <button
                onClick={adicionarMeta}
                disabled={adicionando || !novaMetaNome.trim()}
                style={{
                  padding:      '5px 12px',
                  background:   'var(--ana-accent)',
                  color:        'white',
                  border:       'none',
                  borderRadius: 6,
                  fontSize:     12,
                  fontWeight:   500,
                  cursor:       'pointer',
                  fontFamily:   'var(--font-dm-sans), sans-serif',
                  opacity:      adicionando || !novaMetaNome.trim() ? 0.5 : 1,
                }}
              >
                + Adicionar
              </button>
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
