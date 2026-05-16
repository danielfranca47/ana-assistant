import { apiFetch } from '@/lib/apiFetch'

export interface MensagemHistorico {
  role: 'user' | 'assistant'
  content: string
}

export async function chat(
  message: string,
  history: MensagemHistorico[],
): Promise<string> {
  const result = await apiFetch.post<{ reply: string }>('/api/ana/chat', {
    message,
    history,
  })
  if (!result.data) throw new Error(result.error ?? 'Erro inesperado')
  return result.data.reply
}

export async function transcribe(audioBlob: Blob): Promise<string> {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'gravacao.webm')

  const result = await apiFetch.postForm<{ transcript: string }>(
    '/api/ana/transcribe',
    formData,
  )
  if (!result.data) throw new Error(result.error ?? 'Erro inesperado')
  return result.data.transcript
}
