'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { sendMessage } from '@/services/chat'
import * as anaService from '@/services/ana'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import ConversationMode from '@/components/ConversationMode'

interface Mensagem {
  role: 'user' | 'assistant'
  content: string
}

function falarTexto(texto: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(texto)
  utterance.lang = 'pt-BR'
  utterance.rate = 1
  window.speechSynthesis.speak(utterance)
}

export default function ChatPage() {
  const [historico, setHistorico] = useState<Mensagem[]>([])
  const [input, setInput] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [modoConversa, setModoConversa] = useState(false)
  const listaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: 'smooth' })
  }, [historico])

  async function enviarMensagem(texto: string) {
    const textoTrimado = texto.trim()
    if (!textoTrimado || carregando) return

    const novaMensagem: Mensagem = { role: 'user', content: textoTrimado }
    const novoHistorico = [...historico, novaMensagem]
    setHistorico(novoHistorico)
    setInput('')
    setCarregando(true)
    setErro(null)

    try {
      const reply = await sendMessage(textoTrimado, historico)
      const resposta: Mensagem = { role: 'assistant', content: reply }
      setHistorico([...novoHistorico, resposta])
      falarTexto(reply)
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
          await enviarMensagem(transcript)
        }
      } catch {
        setErro('Erro ao transcrever áudio. Tente novamente.')
        setCarregando(false)
      }
    },
    // enviarMensagem muda com historico; incluída via closure atualizada a cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historico, carregando],
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
    <div className="flex flex-col h-full" style={{ background: 'var(--ana-bg)' }}>
      {modoConversa && (
        <ConversationMode onClose={() => setModoConversa(false)} />
      )}

      {/* Barra de acção de voz */}
      <div style={{
        background: 'var(--ana-surface)',
        borderBottom: '0.5px solid var(--ana-border)',
        padding: '10px 16px',
        display: 'flex',
        justifyContent: 'flex-end',
      }}>
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

      {/* Área de input */}
      <div className="px-4 py-3 flex items-end gap-2" style={{ background: 'var(--ana-surface)', borderTop: '0.5px solid var(--ana-border)' }}>
        {/* Campo de texto */}
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

        {/* Botão microfone */}
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

        {/* Botão enviar */}
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
  )
}
