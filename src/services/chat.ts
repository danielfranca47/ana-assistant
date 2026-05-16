import { apiFetch } from '@/lib/apiFetch'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function sendMessage(message: string, history: Message[]): Promise<string> {
  const result = await apiFetch.post<{ reply: string }>('/api/ana/chat', { message, history })
  if (!result.data) {
    if (result.error?.includes('ANTHROPIC_API_KEY')) {
      throw new Error('Chave de API não configurada. Aceda a /setup para configurar.')
    }
    throw new Error(result.error ?? 'Erro inesperado ao contactar a Ana.')
  }
  return result.data.reply
}
