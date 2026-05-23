'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/apiFetch'

interface Suggestion {
  startTime: string
  endTime:   string
  reason:    string
}

interface Props {
  taskName: string
  duration: number   // em minutos; 0 usa 60 como fallback
  priority: string   // 'alta' | 'media' | 'baixa'
  date:     string   // YYYY-MM-DD
  onAccept: (startTime: string, endTime: string) => void
}

type Status = 'idle' | 'loading' | 'suggested' | 'error'

export default function SlotSuggestionButton({ taskName, duration, priority, date, onAccept }: Props) {
  const [status,     setStatus]     = useState<Status>('idle')
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [excluded,   setExcluded]   = useState<Array<{ start: string; end: string }>>([])
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)

  async function fetchSuggestion(excludeSlots: Array<{ start: string; end: string }>) {
    setStatus('loading')
    setErrorMsg(null)

    const res = await apiFetch.post<Suggestion | null>('/api/ana/suggest-slot', {
      taskName,
      duration: duration > 0 ? duration : 60,
      priority: priority || 'media',
      date,
      preferredPeriod: 'qualquer',
      excludeSlots,
    })

    if (res.error) {
      setStatus('error')
      setErrorMsg('Erro ao contactar a Ana')
      return
    }

    if (!res.data) {
      setStatus('error')
      setErrorMsg('Sem slots disponíveis neste dia')
      return
    }

    setSuggestion(res.data)
    setStatus('suggested')
  }

  function handleSuggest() {
    void fetchSuggestion(excluded)
  }

  function handleAccept() {
    if (!suggestion) return
    onAccept(suggestion.startTime, suggestion.endTime)
    setStatus('idle')
    setSuggestion(null)
    setExcluded([])
  }

  function handleRetry() {
    if (!suggestion) return
    const newExcluded = [...excluded, { start: suggestion.startTime, end: suggestion.endTime }]
    setExcluded(newExcluded)
    setSuggestion(null)
    void fetchSuggestion(newExcluded)
  }

  function handleCancel() {
    setStatus('idle')
    setSuggestion(null)
    setExcluded([])
    setErrorMsg(null)
  }

  if (status === 'loading') {
    return (
      <p style={{ fontSize: 11, color: 'var(--ana-muted, #888)', fontStyle: 'italic', margin: '4px 0' }}>
        A analisar a sua agenda...
      </p>
    )
  }

  if (status === 'suggested' && suggestion) {
    return (
      <div style={{
        background:   'var(--ana-surface, #f9f9f9)',
        border:       '0.5px solid var(--ana-accent, #7c3aed)',
        borderRadius: 6,
        padding:      '8px 10px',
        fontSize:     11,
      }}>
        <p style={{ color: 'var(--ana-text, #111)', marginBottom: 6, lineHeight: 1.4 }}>
          <span style={{ color: 'var(--ana-accent, #7c3aed)', fontWeight: 600 }}>
            ✦ Ana sugere {suggestion.startTime}
          </span>{' '}
          — {suggestion.reason}
        </p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={handleAccept}
            style={{
              padding:      '3px 10px',
              borderRadius: 4,
              border:       '0.5px solid var(--ana-accent, #7c3aed)',
              background:   'var(--ana-accent, #7c3aed)',
              color:        'white',
              fontSize:     11,
              cursor:       'pointer',
              fontFamily:   'var(--font-dm-sans), sans-serif',
            }}
          >✓ Aceitar</button>
          <button
            onClick={handleRetry}
            style={{
              padding:      '3px 10px',
              borderRadius: 4,
              border:       '0.5px solid var(--ana-border, #e5e7eb)',
              background:   'transparent',
              color:        'var(--ana-muted, #888)',
              fontSize:     11,
              cursor:       'pointer',
              fontFamily:   'var(--font-dm-sans), sans-serif',
            }}
          >↻ Sugerir outro</button>
          <button
            onClick={handleCancel}
            style={{
              padding:      '3px 6px',
              borderRadius: 4,
              border:       'none',
              background:   'transparent',
              color:        'var(--ana-muted, #aaa)',
              fontSize:     11,
              cursor:       'pointer',
            }}
          >✕</button>
        </div>
      </div>
    )
  }

  // idle ou error
  return (
    <div>
      <button
        type="button"
        onClick={handleSuggest}
        disabled={!taskName.trim()}
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        4,
          background: 'transparent',
          border:     'none',
          padding:    0,
          cursor:     taskName.trim() ? 'pointer' : 'default',
          fontSize:   11,
          color:      taskName.trim() ? 'var(--ana-accent, #7c3aed)' : 'var(--ana-muted, #ccc)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}
      >
        <span style={{ fontSize: 13 }}>✦</span> Ana, sugere um horário
      </button>
      {errorMsg && (
        <p style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errorMsg}</p>
      )}
    </div>
  )
}
