'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { sendMessage } from '@/services/chat'
import * as anaService from '@/services/ana'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import ConversationMode from '@/components/ConversationMode'
import { apiFetch } from '@/lib/apiFetch'

interface Mensagem {
  role: 'user' | 'assistant'
  content: string
}

interface Conversa {
  id: string
  title: string
  updatedAt: string
}

const STORAGE_KEY = 'ana_active_conversation'

function dataRelativa(dateStr: string): string {
  const dias = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'ontem'
  return `há ${dias} dias`
}

function getVozFeminina(): SpeechSynthesisVoice | null {
  const vozes = window.speechSynthesis.getVoices()
  return (
    vozes.find(v => v.lang === 'pt-BR' && /maria|female|feminina/i.test(v.name)) ??
    vozes.find(v => v.lang === 'pt-BR') ??
    null
  )
}

function falarTexto(texto: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(texto)
  utterance.lang = 'pt-BR'
  utterance.rate = 1
  const voz = getVozFeminina()
  if (voz) utterance.voice = voz
  window.speechSynthesis.speak(utterance)
}

export default function ChatPage() {
  const [historico, setHistorico] = useState<Mensagem[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [sidebarAberta, setSidebarAberta] = useState(false)
  const [input, setInput] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [modoConversa, setModoConversa] = useState(false)
  const listaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: 'smooth' })
  }, [historico])

  async function carregarListaConversas(): Promise<Conversa[]> {
    const result = await apiFetch.get<Conversa[]>('/api/conversations')
    const lista = result.data ?? []
    setConversas(lista)
    return lista
  }

  async function carregarConversa(id: string) {
    const result = await apiFetch.get<{ id: string; title: string; messages: Mensagem[] }>(
      `/api/conversations/${id}`,
    )
    if (result.data) {
      setConversationId(result.data.id)
      setHistorico(result.data.messages)
      localStorage.setItem(STORAGE_KEY, result.data.id)
    }
  }

  async function criarNovaConversa(): Promise<string> {
    const result = await apiFetch.post<{ id: string }>('/api/conversations', {})
    const id = result.data?.id ?? ''
    if (id) localStorage.setItem(STORAGE_KEY, id)
    return id
  }

  useEffect(() => {
    async function init() {
      const lista = await carregarListaConversas()
      const idGuardado = localStorage.getItem(STORAGE_KEY)
      const existe = idGuardado && lista.some(c => c.id === idGuardado)

      if (existe && idGuardado) {
        await carregarConversa(idGuardado)
      } else {
        const novoId = await criarNovaConversa()
        setConversationId(novoId)
        setHistorico([])
        await carregarListaConversas()
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function novaConversa() {
    const id = await criarNovaConversa()
    setConversationId(id)
    setHistorico([])
    setSidebarAberta(false)
    await carregarListaConversas()
  }

  async function apagarConversa(id: string) {
    if (!confirm('Apagar esta conversa?')) return
    await apiFetch.delete(`/api/conversations/${id}`)
    const lista = await carregarListaConversas()
    if (id === conversationId) {
      if (lista.length > 0) {
        await carregarConversa(lista[0].id)
      } else {
        const novoId = await criarNovaConversa()
        setConversationId(novoId)
        setHistorico([])
        await carregarListaConversas()
      }
    }
  }

  async function enviarMensagem(texto: string) {
    const textoTrimado = texto.trim()
    if (!textoTrimado || carregando) return

    const novaMensagem: Mensagem = { role: 'user', content: textoTrimado }
    setHistorico(h => [...h, novaMensagem])
    setInput('')
    setCarregando(true)
    setErro(null)

    try {
      const { reply, conversationId: convId } = await sendMessage(textoTrimado, conversationId)
      setHistorico(h => [...h, { role: 'assistant', content: reply }])
      setConversationId(convId)
      localStorage.setItem(STORAGE_KEY, convId)
      falarTexto(reply)
      await carregarListaConversas()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível obter resposta da Ana. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  const handleAudioBlob = useCallback(
    async (blob: Blob) => {
      setCarregando(true)
      setErro(null)
      try {
        const transcript = await anaService.transcribe(blob)
        if (transcript.trim()) {
          setInput(transcript)
          await enviarMensagem(transcript)
        }
      } catch {
        setErro('Erro ao transcrever áudio. Tente novamente.')
        setCarregando(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, carregando],
  )

  const { status: voiceStatus, startRecording, stopRecording } = useVoiceRecorder(handleAudioBlob)

  const isRecording = voiceStatus === 'recording'
  const isProcessing = voiceStatus === 'processing' || carregando

  function handleMicClick() {
    if (isRecording) {
      stopRecording()
    } else if (!isProcessing) {
      startRecording()
    }
  }

  return (
    <div className="flex h-full" style={{ background: 'var(--ana-bg)' }}>
      {modoConversa && (
        <ConversationMode onClose={() => setModoConversa(false)} />
      )}

      {/* Overlay mobile */}
      {sidebarAberta && (
        <div
          className="fixed inset-0 bg-black/30 z-10 md:hidden"
          onClick={() => setSidebarAberta(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative z-20 md:z-auto
          h-full flex flex-col
          transition-transform duration-200
          ${sidebarAberta ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          width: 240,
          background: 'var(--ana-surface)',
          borderRight: '0.5px solid var(--ana-border)',
          flexShrink: 0,
        }}
      >
        {/* Botão nova conversa */}
        <div style={{ padding: '12px 10px 8px', borderBottom: '0.5px solid var(--ana-border)' }}>
          <button
            onClick={novaConversa}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 8,
              border: '0.5px solid var(--ana-border)',
              background: 'var(--ana-bg)',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'var(--font-dm-sans), sans-serif',
              color: 'var(--ana-text, #111)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nova conversa
          </button>
        </div>

        {/* Lista de conversas */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '6px 6px' }}>
          {conversas.map(c => (
            <div
              key={c.id}
              onClick={() => { carregarConversa(c.id); setSidebarAberta(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '7px 8px',
                borderRadius: 7,
                cursor: 'pointer',
                marginBottom: 2,
                background: c.id === conversationId ? 'var(--ana-accent-light, #f0f0f0)' : 'transparent',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => {
                if (c.id !== conversationId) (e.currentTarget as HTMLElement).style.background = 'var(--ana-hover, #f5f5f5)'
              }}
              onMouseLeave={e => {
                if (c.id !== conversationId) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: c.id === conversationId ? 600 : 400,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'var(--ana-text, #111)',
                }}>
                  {c.title}
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>
                  {dataRelativa(c.updatedAt)}
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); apagarConversa(c.id) }}
                title="Apagar conversa"
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: '#bbb',
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e55' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#bbb' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Área do chat */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Barra de acção */}
        <div style={{
          background: 'var(--ana-surface)',
          borderBottom: '0.5px solid var(--ana-border)',
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          {/* Botão hamburger (mobile) */}
          <button
            className="md:hidden"
            onClick={() => setSidebarAberta(s => !s)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: 6,
              color: '#666',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <button
            onClick={() => setModoConversa(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              background: 'var(--ana-accent)',
              color: 'white',
              border: 'none',
              borderRadius: 20,
              padding: '6px 14px',
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              marginLeft: 'auto',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            Iniciar conversa com Ana
          </button>
        </div>

        {/* Histórico */}
        <div ref={listaRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: 'var(--ana-bg)' }}>
          {historico.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-16">
              <p className="text-2xl mb-2">👋</p>
              <p>Olá! Como posso ajudá-lo hoje?</p>
              <p className="text-xs mt-1">Use o campo abaixo ou o microfone para conversar com a Ana.</p>
            </div>
          )}

          {historico.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gray-900 text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        {/* Erro */}
        {erro && (
          <div className="mx-4 mb-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {erro}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 flex items-end gap-2" style={{ background: 'var(--ana-surface)', borderTop: '0.5px solid var(--ana-border)', flexShrink: 0 }}>
          <textarea
            rows={1}
            placeholder="Digite uma mensagem..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviarMensagem(input)
              }
            }}
            disabled={isProcessing || isRecording}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 disabled:bg-gray-50 disabled:text-gray-400 max-h-32"
          />

          <button
            onClick={handleMicClick}
            disabled={isProcessing && !isRecording}
            title={isRecording ? 'Parar gravação' : 'Gravar mensagem de voz'}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                : isProcessing
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
          >
            {isRecording ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          <button
            onClick={() => enviarMensagem(input)}
            disabled={!input.trim() || isProcessing || isRecording}
            className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center shrink-0 hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
