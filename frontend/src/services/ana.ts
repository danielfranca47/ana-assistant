import api from './api'

export interface MensagemHistorico {
  role: 'user' | 'assistant'
  content: string
}

export async function chat(
  message: string,
  history: MensagemHistorico[],
): Promise<string> {
  const res = await api.post<{ data: { reply: string } }>('/ana/chat', {
    message,
    history,
  })
  return res.data.data.reply
}

export async function transcribe(audioBlob: Blob): Promise<string> {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'gravacao.webm')

  const res = await api.post<{ data: { transcript: string } }>(
    '/ana/transcribe',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return res.data.data.transcript
}
