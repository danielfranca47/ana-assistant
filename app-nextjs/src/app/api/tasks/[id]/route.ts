import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  time: z.string().optional(),
  duration: z.number().int().positive().optional(),
  priority: z.enum(['alta', 'media', 'baixa']).optional(),
  category: z.string().optional(),
  status: z.enum(['pending', 'done', 'current', 'late']).optional(),
})

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

    const task = await prisma.task.findUnique({ where: { id } })
    if (!task) {
      return err('Tarefa não encontrada', 404)
    }

    const updated = await prisma.task.update({ where: { id }, data: parsed.data })
    return ok(updated)
  } catch {
    return err('Erro interno', 500)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params
    const task = await prisma.task.findUnique({ where: { id } })
    if (!task) {
      return err('Tarefa não encontrada', 404)
    }

    await prisma.task.delete({ where: { id } })
    return ok(null)
  } catch {
    return err('Erro interno', 500)
  }
}
