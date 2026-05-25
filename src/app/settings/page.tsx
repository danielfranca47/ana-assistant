'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { speak } from '@/lib/speech'

interface StatusResult {
  hasAnthropic: boolean
  hasOpenAI: boolean
}

export default function SettingsPage() {
  const router = useRouter()

  // ── Chaves de API ──
  const [status, setStatus] = useState<StatusResult | null>(null)
  const [editingKey, setEditingKey] = useState<'none' | 'anthropic' | 'openai' | 'both'>('none')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [savingKeys, setSavingKeys] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [keySuccess, setKeySuccess] = useState(false)

  // ── Voz da Ana ──
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string>('')
  const [rate, setRate] = useState(0.95)
  const [pitch, setPitch] = useState(1.05)

  // Carrega status das chaves
  useEffect(() => {
    fetch('/api/setup/status')
      .then(r => r.json())
      .then((json: { data: StatusResult }) => setStatus(json.data))
      .catch(() => setStatus({ hasAnthropic: false, hasOpenAI: false }))
  }, [])

  // Carrega vozes disponíveis e prefs guardadas
  useEffect(() => {
    const loadVoices = () => {
      const all = speechSynthesis.getVoices()
      const pt = all.filter(v => v.lang.startsWith('pt'))
      setVoices(pt.length > 0 ? pt : all)
    }
    loadVoices()
    speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  useEffect(() => {
    setSelectedVoice(localStorage.getItem('ana_voice_name') ?? '')
    setRate(parseFloat(localStorage.getItem('ana_voice_rate') ?? '0.95'))
    setPitch(parseFloat(localStorage.getItem('ana_voice_pitch') ?? '1.05'))
  }, [])

  // Guarda prefs de voz em localStorage imediatamente ao mudar
  const handleVoiceChange = useCallback((name: string) => {
    setSelectedVoice(name)
    localStorage.setItem('ana_voice_name', name)
  }, [])

  const handleRateChange = useCallback((val: number) => {
    setRate(val)
    localStorage.setItem('ana_voice_rate', String(val))
  }, [])

  const handlePitchChange = useCallback((val: number) => {
    setPitch(val)
    localStorage.setItem('ana_voice_pitch', String(val))
  }, [])

  // Guarda chaves de API
  async function handleSaveKeys() {
    setKeyError(null)
    setSavingKeys(true)
    try {
      const body: Record<string, string> = {}
      if (editingKey === 'anthropic' || editingKey === 'both') body.anthropicKey = anthropicKey
      if (editingKey === 'openai' || editingKey === 'both') body.openaiKey = openaiKey

      const res = await fetch('/api/setup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { data: { success: boolean } | null; error: string | null }
      if (!res.ok || json.error) {
        setKeyError(json.error ?? 'Erro ao guardar as chaves.')
        return
      }
      setKeySuccess(true)
      setEditingKey('none')
      setAnthropicKey('')
      setOpenaiKey('')
      // Actualiza status
      fetch('/api/setup/status')
        .then(r => r.json())
        .then((j: { data: StatusResult }) => setStatus(j.data))
        .catch(() => {})
      setTimeout(() => setKeySuccess(false), 3000)
    } catch {
      setKeyError('Sem ligação ao servidor. Tente novamente.')
    } finally {
      setSavingKeys(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f5f0e8] px-4 py-8">
      <div className="w-full max-w-lg mx-auto space-y-6">

        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-[#5a6e63] hover:text-[#1c3a2a] transition-colors text-sm flex items-center gap-1"
          >
            ← Voltar
          </button>
          <h1 className="text-2xl font-[family-name:var(--font-cormorant)] font-light text-[#1c3a2a] tracking-wide">
            Configurações
          </h1>
        </div>

        {/* Secção: Chaves de API */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#e8e0d5] p-6">
          <h2 className="text-base font-medium text-[#1c3a2a] mb-4">Chaves de API</h2>

          {keySuccess && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-4">
              Chaves guardadas com sucesso.
            </p>
          )}
          {keyError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
              {keyError}
            </p>
          )}

          {/* Anthropic */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-[#1c3a2a]">ANTHROPIC_API_KEY</label>
              <span className={`text-xs px-2 py-0.5 rounded-full ${status?.hasAnthropic ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {status?.hasAnthropic ? 'configurada' : 'não configurada'}
              </span>
            </div>
            {(editingKey === 'anthropic' || editingKey === 'both') ? (
              <input
                type="password"
                value={anthropicKey}
                onChange={e => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full rounded-lg border border-[#c8bfb0] bg-[#faf8f5] px-3 py-2.5 text-sm text-[#1c3a2a] placeholder:text-[#b0a898] outline-none focus:border-[#1c3a2a] focus:ring-1 focus:ring-[#1c3a2a] transition-colors"
              />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#8a9e93] font-mono">sk-ant-••••••••••••••</span>
                <button
                  onClick={() => { setEditingKey('anthropic'); setKeyError(null) }}
                  className="text-xs text-[#5a6e63] hover:text-[#1c3a2a] underline underline-offset-2 transition-colors"
                >
                  Alterar
                </button>
              </div>
            )}
          </div>

          {/* OpenAI */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-[#1c3a2a]">OPENAI_API_KEY</label>
              <span className={`text-xs px-2 py-0.5 rounded-full ${status?.hasOpenAI ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {status?.hasOpenAI ? 'configurada' : 'não configurada'}
              </span>
            </div>
            {(editingKey === 'openai' || editingKey === 'both') ? (
              <input
                type="password"
                value={openaiKey}
                onChange={e => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-lg border border-[#c8bfb0] bg-[#faf8f5] px-3 py-2.5 text-sm text-[#1c3a2a] placeholder:text-[#b0a898] outline-none focus:border-[#1c3a2a] focus:ring-1 focus:ring-[#1c3a2a] transition-colors"
              />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#8a9e93] font-mono">sk-••••••••••••••</span>
                <button
                  onClick={() => { setEditingKey('openai'); setKeyError(null) }}
                  className="text-xs text-[#5a6e63] hover:text-[#1c3a2a] underline underline-offset-2 transition-colors"
                >
                  Alterar
                </button>
              </div>
            )}
          </div>

          {editingKey !== 'none' && (
            <div className="flex gap-2">
              <button
                onClick={handleSaveKeys}
                disabled={savingKeys}
                className="flex-1 bg-[#1c3a2a] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#2a5040] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingKeys ? 'A guardar...' : 'Guardar'}
              </button>
              <button
                onClick={() => { setEditingKey('none'); setAnthropicKey(''); setOpenaiKey(''); setKeyError(null) }}
                className="px-4 rounded-lg border border-[#c8bfb0] text-sm text-[#5a6e63] hover:text-[#1c3a2a] hover:border-[#1c3a2a] transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Secção: Voz da Ana */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#e8e0d5] p-6">
          <h2 className="text-base font-medium text-[#1c3a2a] mb-4">Voz da Ana</h2>

          {/* Selector de voz */}
          <div className="mb-4">
            <label className="text-sm font-medium text-[#1c3a2a] block mb-1.5">Voz</label>
            <select
              value={selectedVoice}
              onChange={e => handleVoiceChange(e.target.value)}
              className="w-full rounded-lg border border-[#c8bfb0] bg-[#faf8f5] px-3 py-2.5 text-sm text-[#1c3a2a] outline-none focus:border-[#1c3a2a] focus:ring-1 focus:ring-[#1c3a2a] transition-colors"
            >
              <option value="">— Automática (português) —</option>
              {voices.map(v => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          {/* Velocidade */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-[#1c3a2a]">Velocidade</label>
              <span className="text-xs text-[#8a9e93]">{rate.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={rate}
              onChange={e => handleRateChange(parseFloat(e.target.value))}
              className="w-full accent-[#1c3a2a]"
            />
            <div className="flex justify-between text-xs text-[#b0a898] mt-0.5">
              <span>0.5×</span>
              <span>1.5×</span>
            </div>
          </div>

          {/* Tom */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-[#1c3a2a]">Tom</label>
              <span className="text-xs text-[#8a9e93]">{pitch.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={pitch}
              onChange={e => handlePitchChange(parseFloat(e.target.value))}
              className="w-full accent-[#1c3a2a]"
            />
            <div className="flex justify-between text-xs text-[#b0a898] mt-0.5">
              <span>0.5</span>
              <span>1.5</span>
            </div>
          </div>

          {/* Botão testar */}
          <button
            onClick={() => speak('Olá, sou a Ana, a sua assistente pessoal.')}
            className="w-full border border-[#1c3a2a] text-[#1c3a2a] rounded-lg py-2.5 text-sm font-medium hover:bg-[#1c3a2a] hover:text-white transition-colors"
          >
            Testar voz
          </button>
        </div>

      </div>
    </div>
  )
}
