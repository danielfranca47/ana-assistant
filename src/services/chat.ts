import { apiFetch } from '@/lib/apiFetch'

export interface PendingAction {
  tool: string
  input: Record<string, unknown>
}

export interface SendMessageResult {
  reply: string
  conversationId: string
  pendingAction?: PendingAction
}

export async function sendMessage(
  message: string,
  conversationId?: string | null,
): Promise<SendMessageResult> {
  const result = await apiFetch.post<SendMessageResult>(
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
