import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, err, parseUTCDate } from '@/lib/api'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  category: z.enum(['work', 'meet', 'pers', 'break']).optional(),
  notes: z.string().optional(),
  recurrence: z.string().optional(),
  recurrenceDays: z.string().optional(),
  recurrenceEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scope: z.enum(['single', 'following', 'all']).optional(),
})

async function getRootId(event: { id: string; parentId: string | null }): Promise<string> {
  return event.parentId ?? event.id
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return err('Dados inválidos', 422)
    }

    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) {
      return err('Evento não encontrado', 404)
    }

    const { date, scope, ...campos } = parsed.data
    const dadosBase = date ? { ...campos, date: parseUTCDate(date) } : campos

    if (!scope || scope === 'single') {
      const updated = await prisma.event.update({ where: { id }, data: dadosBase })
      return ok(updated)
    }

    const rootId = await getRootId(event)

    if (scope === 'all') {
      await prisma.event.updateMany({
        where: { OR: [{ id: rootId }, { parentId: rootId }] },
        data: campos, // não altera date em bulk
      })
    } else {
      // 'following' — este evento e todos os seguintes da mesma série
      await prisma.event.updateMany({
        where: {
          OR: [
            { id },
            { parentId: rootId, date: { gt: event.date } },
          ],
        },
        data: campos,
      })
    }

    return ok(null)
  } catch {
    return err('Erro interno', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params
    const scope = request.nextUrl.searchParams.get('scope') ?? 'single'

    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) {
      return err('Evento não encontrado', 404)
    }

    if (scope === 'single') {
      await prisma.event.delete({ where: { id } })
      return ok(null)
    }

    const rootId = await getRootId(event)

    if (scope === 'all') {
      await prisma.event.deleteMany({
        where: { OR: [{ id: rootId }, { parentId: rootId }] },
      })
    } else {
      // 'following' — este e todos os seguintes
      await prisma.event.deleteMany({
        where: {
          OR: [
            { id },
            { parentId: rootId, date: { gte: event.date } },
          ],
        },
      })
      // Se apagámos o próprio pai, o root também deve sair (já está incluído acima se id === rootId)
    }

    return ok(null)
  } catch {
    return err('Erro interno', 500)
  }
}
