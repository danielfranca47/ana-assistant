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

    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) {
      return err('Evento não encontrado', 404)
    }

    const { date, ...rest } = parsed.data
    const updated = await prisma.event.update({
      where: { id },
      data: date ? { ...rest, date: parseUTCDate(date) } : rest,
    })
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
    const event = await prisma.event.findUnique({ where: { id } })
    if (!event) {
      return err('Evento não encontrado', 404)
    }

    await prisma.event.delete({ where: { id } })
    return ok(null)
  } catch {
    return err('Erro interno', 500)
  }
}
