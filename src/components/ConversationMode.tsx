'use client'

import { useState, useRef, useEffect } from 'react'
import * as anaService from '@/services/ana'
import type { MensagemHistorico } from '@/services/ana'

type Phase = 'idle' | 'ready' | 'listening' | 'processing' | 'speaking'

interface Entrada {
  role: 'user' | 'assistant'
  content: string
}

const SILENCE_THRESHOLD = 0.01
const SILENCE_DURATION_MS = 1500
const MIN_RECORDING_MS = 400 // evita disparar silêncio antes do usuário falar

const STATUS_LABEL: Record<Phase, string> = {
  idle:       'Iniciando...',
  ready:      'Ana está pronta — pode falar',
  listening:  'A ouvir...',
  processing: 'A processar...',
  speaking:   'Ana a responder...',
}

const STATUS_COLOR: Record<Phase, string> = {
  idle:       'bg-gray-500',
  ready:      'bg-green-400 animate-pulse',
  listening:  'bg-green-400 animate-pulse',
  processing: 'bg-amber-400',
  speaking:   'bg-blue-400 animate-pulse',
}

interface Props {
  onClose: () => void
}

export default function ConversationMode({ onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [conversa, setConversa] = useState<Entrada[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const conversaEndRef = useRef<HTMLDivElement>(null)

  // Todos os refs de controle de sessão — evitam closures stale em callbacks assíncronos
  const mountedRef = useRef(true)
  const isActiveRef = useRef(false)
  const phaseRef = useRef<Phase>('idle')
  const conversaRef = useRef<Entrada[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const silenceStartRef = useRef<number | null>(null)
  const hasSpeechRef = useRef(false)
  const recordingStartRef = useRef(0)
  const animFrameRef = useRef(0)

  function syncPhase(p: Phase) {
    phaseRef.current = p
    if (mountedRef.current) setPhase(p)
  }

  function syncConversa(entries: Entrada[]) {
    conversaRef.current = entries
    if (mountedRef.current) setConversa(entries)
  }

  function limparSessao() {
    isActiveRef.current = false
    cancelAnimationFrame(animFrameRef.current)
    window.speechSynthesis.cancel()
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
  }

  async function iniciarSessao() {
    if (mountedRef.current) setErro(null)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      if (mountedRef.current) setErro('Permissão de microfone negada.')
      return
    }

    if (!mountedRef.current) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }

    streamRef.current = stream

    let audioCtx: AudioContext
    try {
      audioCtx = new AudioContext()
      await audioCtx.resume()
    } catch {
      if (mountedRef.current) setErro('Erro ao inicializar contexto de áudio.')
      stream.getTracks().forEach((t) => t.stop())
      return
    }
    audioCtxRef.current = audioCtx

    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)

    isActiveRef.current = true
    syncPhase('ready')

    // Pausa breve para o indicador "pronta" ser visível antes da escuta iniciar
    await new Promise<void>((r) => setTimeout(r, 800))
    if (isActiveRef.current) iniciarEscuta()

    // ── Funções internas da sessão ──
    // Definidas como function declarations para permitir referências cruzadas (hoisting).
    // Fecham sobre `stream` e `analyser` (locais) e acessam refs do componente.

    function calcRMS(data: Uint8Array): number {
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const n = (data[i] - 128) / 128
        sum += n * n
      }
      return Math.sqrt(sum / data.length)
    }

    function pararRecorder() {
      cancelAnimationFrame(animFrameRef.current)
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop()
      }
    }

    function analisarVolume() {
      if (!isActiveRef.current || phaseRef.current !== 'listening') return

      const data = new Uint8Array(analyser.fftSize)
      analyser.getByteTimeDomainData(data)
      const rms = calcRMS(data)
      const now = Date.now()

      if (rms >= SILENCE_THRESHOLD) {
        hasSpeechRef.current = true
        silenceStartRef.current = null
      } else if (
        hasSpeechRef.current &&
        now - recordingStartRef.current > MIN_RECORDING_MS
      ) {
        if (silenceStartRef.current === null) {
          silenceStartRef.current = now
        } else if (now - silenceStartRef.current >= SILENCE_DURATION_MS) {
          pararRecorder()
          return
        }
      }

      animFrameRef.current = requestAnimationFrame(analisarVolume)
    }

    async function iniciarEscuta() {
      if (!isActiveRef.current) return

      syncPhase('listening')
      chunksRef.current = []
      silenceStartRef.current = null
      hasSpeechRef.current = false
      recordingStartRef.current = Date.now()

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      let recorder: MediaRecorder
      try {
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      } catch {
        if (isActiveRef.current) setTimeout(iniciarEscuta, 500)
        return
      }
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        if (!isActiveRef.current) return

        // Sem chunks = usuário não falou; volta a escutar
        if (chunksRef.current.length === 0) {
          iniciarEscuta()
          return
        }

        syncPhase('processing')
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })

        try {
          const transcript = await anaService.transcribe(blob)
          if (!isActiveRef.current) return

          // Transcrição vazia = silêncio gravado; volta a escutar
          if (!transcript.trim()) {
            iniciarEscuta()
            return
          }

          // Histórico ANTES de adicionar a nova entrada do usuário
          const historicoParaChat: MensagemHistorico[] = conversaRef.current.map(
            (e) => ({ role: e.role, content: e.content }),
          )

          const novaConversa: Entrada[] = [
            ...conversaRef.current,
            { role: 'user', content: transcript },
          ]
          syncConversa(novaConversa)

          const reply = await anaService.chat(transcript, historicoParaChat)
          if (!isActiveRef.current) return

          syncConversa([...novaConversa, { role: 'assistant', content: reply }])
          syncPhase('speaking')

          // TTS — microfone fica pausado enquanto Ana fala
          window.speechSynthesis.cancel()
          const utt = new SpeechSynthesisUtterance(reply)
          utt.lang = 'pt-BR'
          const vozes = window.speechSynthesis.getVoices()
          const vozFem =
            vozes.find(v => v.lang === 'pt-BR' && /maria|female|feminina/i.test(v.name)) ??
            vozes.find(v => v.lang === 'pt-BR') ??
            null
          if (vozFem) utt.voice = vozFem
          utt.onend = () => {
            if (isActiveRef.current) iniciarEscuta()
          }
          // Fallback caso onend não dispare (bug em alguns navegadores)
          utt.onerror = () => {
            if (isActiveRef.current) iniciarEscuta()
          }
          window.speechSynthesis.speak(utt)
        } catch {
          if (!isActiveRef.current) return
          if (mountedRef.current) setErro('Erro ao processar. Retomando em 2s...')
          setTimeout(() => {
            if (!isActiveRef.current) return
            if (mountedRef.current) setErro(null)
            iniciarEscuta()
          }, 2000)
        }
      }

      recorder.start()
      animFrameRef.current = requestAnimationFrame(analisarVolume)
    }
  }

  function encerrar() {
    limparSessao()
    syncConversa([])
    syncPhase('idle')
    if (mountedRef.current) setErro(null)
    onClose()
  }

  useEffect(() => {
    mountedRef.current = true
    iniciarSessao()
    return () => {
      mountedRef.current = false
      limparSessao()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    conversaEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversa])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950/95 backdrop-blur-sm">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-900 text-sm font-bold shrink-0">
            A
          </div>
          <span className="text-white font-medium text-sm">Conversa com Ana</span>
        </div>
        <button
          onClick={encerrar}
          className="text-xs text-gray-400 hover:text-white border border-white/20 hover:border-white/50 rounded-full px-4 py-1.5 transition-colors"
        >
          Encerrar conversa
        </button>
      </div>

      {/* Indicador de fase */}
      <div className="flex items-center justify-center gap-2.5 py-4 border-b border-white/10">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_COLOR[phase]}`} />
        <span className="text-sm text-gray-300">{STATUS_LABEL[phase]}</span>
      </div>

      {/* Erro */}
      {erro && (
        <div className="mx-5 mt-3 text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
          {erro}
        </div>
      )}

      {/* Transcrição da conversa */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {conversa.length === 0 && !erro && (phase === 'ready' || phase === 'listening') && (
          <p className="text-center text-gray-600 text-sm mt-16">
            Pode começar a falar...
          </p>
        )}

        {conversa.map((entrada, i) => (
          <div
            key={i}
            className={`flex flex-col gap-1 ${entrada.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <span className="text-xs text-gray-600 px-1">
              {entrada.role === 'user' ? 'Você disse' : 'Ana'}
            </span>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                entrada.role === 'user'
                  ? 'bg-white/10 text-white rounded-br-sm'
                  : 'bg-white/5 text-gray-200 border border-white/10 rounded-bl-sm'
              }`}
            >
              {entrada.content}
            </div>
          </div>
        ))}

        <div ref={conversaEndRef} />
      </div>
    </div>
  )
}
