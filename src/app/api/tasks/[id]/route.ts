import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, err, parseUTCDate } from '@/lib/api'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  time: z.string().optional(),
  duration: z.number().int().positive().optional(),
  priority: z.enum(['alta', 'media', 'baixa']).optional(),
  category: z.string().optional(),
  status: z.enum(['pending', 'done', 'current', 'late']).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params
    const scope = request.nextUrl.searchParams.get('scope') ?? 'single'
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return err('Dados inválidos', 422)
    }

    const task = await prisma.task.findUnique({ where: { id } })
    if (!task) {
      return err('Tarefa não encontrada', 404)
    }

    const { date, ...rest } = parsed.data
    const updateData = { ...rest, ...(date ? { date: parseUTCDate(date) } : {}) }

    if (scope === 'single' || !task.parentId) {
      const updated = await prisma.task.update({ where: { id }, data: updateData })
      return ok(updated)
    }

    const rootId = task.parentId
    if (scope === 'all') {
      await prisma.task.updateMany({
        where: { OR: [{ id: rootId }, { parentId: rootId }] },
        data: rest, // não alterar date em cascata
      })
    } else {
      // following: este + todos com mesmo parentId e data >= esta tarefa
      await prisma.task.updateMany({
        where: {
          OR: [{ id: rootId }, { parentId: rootId }],
          date: { gte: task.date },
        },
        data: rest,
      })
    }

    const updated = await prisma.task.findUnique({ where: { id } })
    return ok(updated)
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

    const task = await prisma.task.findUnique({ where: { id } })
    if (!task) {
      return err('Tarefa não encontrada', 404)
    }

    if (scope === 'single' || !task.parentId) {
      await prisma.task.delete({ where: { id } })
      return ok(null)
    }

    const rootId = task.parentId
    if (scope === 'all') {
      await prisma.task.deleteMany({
        where: { OR: [{ id: rootId }, { parentId: rootId }] },
      })
    } else {
      // following
      await prisma.task.deleteMany({
        where: {
          OR: [{ id: rootId }, { parentId: rootId }],
          date: { gte: task.date },
        },
      })
    }

    return ok(null)
  } catch {
    return err('Erro interno', 500)
  }
}
