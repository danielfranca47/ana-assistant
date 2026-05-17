import { apiFetch } from '@/lib/apiFetch'

export interface SendMessageResult {
  reply: string
  conversationId: string
}

export async function sendMessage(
  message: string,
  conversationId?: string | null,
): Promise<SendMessageResult> {
  const result = await apiFetch.post<{ reply: string; conversationId: string }>(
    '/api/ana/chat',
    { message, conversationId },
  )
  if (!result.data) {
    if (result.error?.includes('ANTHROPIC_API_KEY')) {
      throw new Error('Chave de API não configurada. Aceda a /setup para configurar.')
    }
    throw new Error(result.error ?? 'Erro inesperado ao contactar a Ana.')
  }
  return result.data
}
