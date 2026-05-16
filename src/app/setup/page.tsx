'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

interface StatusResult {
  configured: boolean
  hasAnthropic: boolean
  hasOpenAI: boolean
}

export default function SetupPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [anthropicKey, setAnthropicKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then((json: { data: StatusResult }) => {
        if (json.data?.configured) router.replace('/')
        else setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)

    try {
      const res = await fetch('/api/setup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anthropicKey, openaiKey }),
      })
      const json = await res.json() as { data: { success: boolean } | null; error: string | null }

      if (!res.ok || json.error) {
        setErro(json.error ?? 'Erro ao guardar as chaves.')
        return
      }

      router.replace('/')
    } catch {
      setErro('Sem ligação ao servidor. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
        <div className="w-6 h-6 rounded-full border-2 border-[#1c3a2a] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[#e8e0d5] p-10">

        {/* Ícone */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-full bg-[#1c3a2a] flex items-center justify-center text-white text-2xl font-[family-name:var(--font-cormorant)] font-semibold tracking-wider">
            A
          </div>
        </div>

        {/* Título */}
        <h1 className="text-center text-3xl font-[family-name:var(--font-cormorant)] font-light text-[#1c3a2a] tracking-wide mb-1">
          Bem-vindo à Ana
        </h1>
        <p className="text-center text-sm text-[#5a6e63] mb-8">
          Configure as suas chaves de API para começar a usar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Anthropic */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-[#1c3a2a]">
                ANTHROPIC_API_KEY
              </label>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#5a6e63] hover:text-[#1c3a2a] underline underline-offset-2 transition-colors"
              >
                console.anthropic.com →
              </a>
            </div>
            <input
              type="password"
              required
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full rounded-lg border border-[#c8bfb0] bg-[#faf8f5] px-3 py-2.5 text-sm text-[#1c3a2a] placeholder:text-[#b0a898] outline-none focus:border-[#1c3a2a] focus:ring-1 focus:ring-[#1c3a2a] transition-colors"
            />
          </div>

          {/* OpenAI */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-[#1c3a2a]">
                OPENAI_API_KEY
              </label>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#5a6e63] hover:text-[#1c3a2a] underline underline-offset-2 transition-colors"
              >
                platform.openai.com →
              </a>
            </div>
            <input
              type="password"
              required
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full rounded-lg border border-[#c8bfb0] bg-[#faf8f5] px-3 py-2.5 text-sm text-[#1c3a2a] placeholder:text-[#b0a898] outline-none focus:border-[#1c3a2a] focus:ring-1 focus:ring-[#1c3a2a] transition-colors"
            />
          </div>

          {/* Erro */}
          {erro && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-[#1c3a2a] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#2a5040] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {carregando ? 'A guardar...' : 'Guardar e começar'}
          </button>
        </form>

        {/* Nota de privacidade */}
        <p className="mt-6 text-center text-xs text-[#8a9e93] leading-relaxed">
          As suas chaves ficam guardadas apenas no seu servidor pessoal
          <br />e nunca são partilhadas.
        </p>
      </div>
    </div>
  )
}
