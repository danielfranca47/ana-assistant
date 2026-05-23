import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api'

const patchSchema = z.object({
  name:         z.string().min(1).optional(),
  currentValue: z.number().min(0).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Dados inválidos', 422)
    }

    const goal = await prisma.goal.findUnique({ where: { id } })
    if (!goal) return err('Meta não encontrada', 404)

    const updated = await prisma.goal.update({
      where: { id },
      data: parsed.data,
    })
    return ok(updated)
  } catch {
    return err('Erro ao actualizar meta', 500)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const goal = await prisma.goal.findUnique({ where: { id } })
    if (!goal) return err('Meta não encontrada', 404)

    await prisma.goal.delete({ where: { id } })
    return ok(null)
  } catch {
    return err('Erro ao apagar meta', 500)
  }
}
