import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api'

const postSchema = z.object({
  title:       z.string().min(1),
  description: z.string().optional(),
  horizon:     z.enum(['1m', '3m', '6m', '1y', '5y']),
})

export async function GET() {
  try {
    const objectives = await prisma.objective.findMany({ orderBy: { createdAt: 'asc' } })
    return ok(objectives)
  } catch {
    return err('Erro ao listar objetivos', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Dados inválidos', 422)
    }
    const { title, description, horizon } = parsed.data
    const objective = await prisma.objective.create({
      data: { title, description, horizon },
    })
    return ok(objective, 201)
  } catch {
    return err('Erro ao criar objetivo', 500)
  }
}
