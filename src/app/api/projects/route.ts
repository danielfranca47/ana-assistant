import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api'

const postSchema = z.object({
  name:        z.string().min(1),
  description: z.string().optional(),
  priority:    z.enum(['alta', 'media', 'baixa']).default('media'),
  activities:  z.array(z.object({ name: z.string().min(1), frequency: z.string() })).default([]),
})

export async function GET() {
  try {
    const projects = await prisma.project.findMany({ orderBy: { createdAt: 'asc' } })
    return ok(projects)
  } catch {
    return err('Erro ao listar projetos', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Dados inválidos', 422)
    }
    const { name, description, priority, activities } = parsed.data
    const project = await prisma.project.create({
      data: { name, description, priority, activities: JSON.stringify(activities) },
    })
    return ok(project, 201)
  } catch {
    return err('Erro ao criar projeto', 500)
  }
}
