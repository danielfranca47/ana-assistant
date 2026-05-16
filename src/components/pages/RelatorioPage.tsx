'use client'

import { useState, useRef } from 'react'
import { apiFetch } from '@/lib/apiFetch'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = any

function getSpeechRecognitionClass(): (new () => AnyRec) | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export default function RelatorioPage() {
  const [done, setDone] = useState('')
  const [undone, setUndone] = useState('')
  const [notes, setNotes] = useState('')
  const [rebalanceando, setRebalanceando] = useState(false)
  const [resultado, setResultado] = useState('')
  const [erroMsg, setErroMsg] = useState('')
  const [gravando, setGravando] = useState(false)
  const recognitionRef = useRef<AnyRec | null>(null)

  function toggleVoz() {
    const SR = getSpeechRecognitionClass()
    if (!SR) return

    if (gravando) {
      recognitionRef.current?.stop()
      setGravando(false)
      return
    }

    const rec = new SR()
    rec.lang = 'pt-BR'
    rec.interimResults = false
    recognitionRef.current = rec

    rec.onresult = (e: AnyRec) => {
      const transcript = e.results[0][0].transcript as string
      setDone((prev) => (prev ? prev + ' ' + transcript : transcript))
    }
    rec.onend = () => setGravando(false)
    rec.start()
    setGravando(true)
  }

  async function rebalancear() {
    if (!done && !undone) {
      setErroMsg('Preencha pelo menos um campo antes de rebalancear.')
      return
    }
    setErroMsg('')
    setRebalanceando(true)
    setResultado('')

    const res = await apiFetch.post<{ suggestions: string }>('/api/ana/rebalance', {
      done,
      undone,
      notes,
    })

    setRebalanceando(false)
    if (res.error) {
      setErroMsg(res.error)
    } else {
      setResultado(res.data?.suggestions ?? '')
    }
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--ana-surface)',
    border: '0.5px solid var(--ana-border)',
    borderRadius: 'var(--ana-radius)',
    padding: 20,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--ana-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 6,
  }

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 90,
    border: '0.5px solid var(--ana-border)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'var(--font-dm-sans), sans-serif',
    color: 'var(--ana-text)',
    background: 'var(--ana-bg)',
    resize: 'vertical',
    outline: 'none',
    lineHeight: 1.5,
  }

  return (
    <div className="overflow-y-auto h-full" style={{ background: 'var(--ana-bg)' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Card principal */}
          <div style={cardStyle}>
            <h2 style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--ana-text)',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ana-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Relatório do Dia
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>O que fiz hoje</label>
                <textarea
                  style={textareaStyle}
                  placeholder="Ex: Finalizei o relatório Q2, tive reunião às 10h, revisei o contrato..."
                  value={done}
                  onChange={(e) => setDone(e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>O que não consegui fazer</label>
                <textarea
                  style={textareaStyle}
                  placeholder="Ex: Não enviei o email de follow-up, não terminei a apresentação..."
                  value={undone}
                  onChange={(e) => setUndone(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Observações / impedimentos</label>
              <textarea
                style={{ ...textareaStyle, minHeight: 64 }}
                rows={2}
                placeholder="Ex: Reuniões se estenderam, tive dificuldade de concentração pela tarde..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Acções */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={toggleVoz}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '10px 16px',
                border: `1.5px solid ${gravando ? 'var(--ana-danger)' : 'var(--ana-accent)'}`,
                borderRadius: 8,
                background: gravando ? 'var(--ana-danger-light)' : 'transparent',
                color: gravando ? 'var(--ana-danger)' : 'var(--ana-accent)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              {gravando ? 'Parar' : 'Relatar por voz'}
            </button>

            <button
              onClick={rebalancear}
              disabled={rebalanceando}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: rebalanceando ? 'var(--ana-accent-light)' : 'var(--ana-accent)',
                color: rebalanceando ? 'var(--ana-accent)' : 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: rebalanceando ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: rebalanceando ? 'spin 1s linear infinite' : 'none' }}>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {rebalanceando ? 'Ana está a analisar...' : 'Ana, rebalancear a minha rotina'}
            </button>
          </div>

          {/* Erro */}
          {erroMsg && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--ana-danger-light)',
              border: '0.5px solid var(--ana-danger)',
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--ana-danger)',
            }}>
              {erroMsg}
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div style={{
              background: 'var(--ana-accent-light)',
              border: '0.5px solid rgba(44,95,74,0.2)',
              borderRadius: 8,
              padding: '16px',
              fontSize: 13,
              color: 'var(--ana-text)',
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
            }}>
              {resultado}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
