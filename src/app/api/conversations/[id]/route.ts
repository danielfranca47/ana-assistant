import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const conversa = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { role: true, content: true, createdAt: true },
        },
      },
    })
    if (!conversa) return err('Conversa não encontrada', 404)
    return ok(conversa)
  } catch (error) {
    console.error('[conversations/[id] GET]', error)
    return err('Erro interno', 500)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.conversation.delete({ where: { id: params.id } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('[conversations/[id] DELETE]', error)
    return err('Erro interno', 500)
  }
}
