import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api'

const patchSchema = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().optional(),
  priority:    z.enum(['alta', 'media', 'baixa']).optional(),
  activities:  z.array(z.object({ name: z.string().min(1), frequency: z.string() })).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Dados inválidos', 422)
    }
    const { activities, ...rest } = parsed.data
    const data: Record<string, unknown> = { ...rest }
    if (activities !== undefined) data.activities = JSON.stringify(activities)
    const project = await prisma.project.update({ where: { id }, data })
    return ok(project)
  } catch {
    return err('Erro ao actualizar projeto', 500)
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.project.delete({ where: { id } })
    return ok(null)
  } catch {
    return err('Erro ao apagar projeto', 500)
  }
}
