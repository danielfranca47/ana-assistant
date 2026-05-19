import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api'

const patchSchema = z.object({
  title:       z.string().min(1).optional(),
  description: z.string().optional(),
  status:      z.enum(['active', 'completed']).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Dados inválidos', 422)
    }
    const objective = await prisma.objective.update({ where: { id }, data: parsed.data })
    return ok(objective)
  } catch {
    return err('Erro ao actualizar objetivo', 500)
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.objective.delete({ where: { id } })
    return ok(null)
  } catch {
    return err('Erro ao apagar objetivo', 500)
  }
}
