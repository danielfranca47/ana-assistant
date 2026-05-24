import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api'

export async function GET() {
  try {
    const conversas = await prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true },
    })
    return ok(conversas)
  } catch (error) {
    console.error('[conversations GET]', error)
    return err('Erro interno', 500)
  }
}

export async function POST() {
  try {
    const conversa = await prisma.conversation.create({
      data: {},
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    })
    return ok(conversa, 201)
  } catch (error) {
    console.error('[conversations POST]', error)
    return err('Erro interno', 500)
  }
}
