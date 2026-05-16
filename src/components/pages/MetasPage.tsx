'use client'

import { useState } from 'react'

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const METAS_INICIAIS = [
  { nome: 'Finalizar projecto X', pct: 72 },
  { nome: 'Reuniões ≤ 10h/sem', pct: 55 },
  { nome: 'Bloco de foco diário', pct: 80 },
  { nome: 'Relatório diário', pct: 40 },
]

const cardStyle: React.CSSProperties = {
  background: 'var(--ana-surface)',
  border: '0.5px solid var(--ana-border)',
  borderRadius: 'var(--ana-radius)',
  padding: 18,
}

const cardTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant), serif',
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--ana-text)',
  marginBottom: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 7,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '7px 0',
  borderBottom: '0.5px solid var(--ana-border)',
  fontSize: 12,
}

const labelStyle: React.CSSProperties = { color: 'var(--ana-muted)' }
const valStyle: React.CSSProperties = { color: 'var(--ana-text)', fontWeight: 500 }

function Toggle({ options, active, onChange }: {
  options: string[]
  active: string[]
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
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 11,
              border: `0.5px solid ${isActive ? 'var(--ana-accent)' : 'var(--ana-border)'}`,
              background: isActive ? 'var(--ana-accent)' : 'transparent',
              color: isActive ? 'white' : 'var(--ana-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

export default function MetasPage() {
  const [diasFolga, setDiasFolga] = useState(['Sáb', 'Dom'])
  const [focoTurno, setFocoTurno] = useState(['Manhã'])
  const [notificacoes, setNotificacoes] = useState(['Activas'])
  const [checkIn, setCheckIn] = useState(['Sex tarde'])

  function toggle(current: string[], opt: string): string[] {
    return current.includes(opt) ? current.filter((x) => x !== opt) : [...current, opt]
  }

  return (
    <div className="overflow-y-auto h-full" style={{ background: 'var(--ana-bg)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 24px' }}>
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
            <div style={{ ...rowStyle }}>
              <span style={labelStyle}>Início do trabalho</span>
              <span style={valStyle}>08h00</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Fim do trabalho</span>
              <span style={valStyle}>18h00</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Almoço</span>
              <span style={valStyle}>12h00 – 13h00</span>
            </div>
            <div style={{ ...rowStyle }}>
              <span style={labelStyle}>Dias de folga</span>
              <Toggle
                options={DIAS_SEMANA}
                active={diasFolga}
                onChange={(opt) => setDiasFolga(toggle(diasFolga, opt))}
              />
            </div>
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <span style={labelStyle}>Foco profundo</span>
              <Toggle
                options={['Manhã', 'Tarde']}
                active={focoTurno}
                onChange={(opt) => setFocoTurno(toggle(focoTurno, opt))}
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
              {METAS_INICIAIS.map((meta) => (
                <div key={meta.nome} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--ana-text)', flex: 1 }}>{meta.nome}</span>
                  <div style={{ width: 80, height: 5, background: 'var(--ana-border)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ width: `${meta.pct}%`, height: '100%', background: 'var(--ana-accent)', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ana-muted)', width: 30, textAlign: 'right', flexShrink: 0 }}>{meta.pct}%</span>
                </div>
              ))}
            </div>
            <button style={{
              width: '100%',
              marginTop: 14,
              padding: '8px',
              background: 'var(--ana-accent)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}>
              + Adicionar meta
            </button>
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
                onChange={(opt) => setCheckIn(toggle(checkIn, opt))}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
