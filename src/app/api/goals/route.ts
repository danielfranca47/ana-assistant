import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api'

function getWeekStart(): Date {
  const now = new Date()
  const day = now.getUTCDay() // 0=Dom ... 6=Sáb
  const diff = (day === 0 ? -6 : 1 - day) // ajuste para segunda-feira
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff))
  return weekStart
}

export async function GET() {
  try {
    const weekStart = getWeekStart()
    const goals = await prisma.goal.findMany({ orderBy: { createdAt: 'asc' } })

    const toReset = goals.filter((g) => g.weekStartDate < weekStart)
    if (toReset.length > 0) {
      await Promise.all(
        toReset.map((g) =>
          prisma.goal.update({
            where: { id: g.id },
            data: { currentValue: 0, weekStartDate: weekStart },
          }),
        ),
      )
      const resetado = await prisma.goal.findMany({ orderBy: { createdAt: 'asc' } })
      return ok(resetado)
    }

    return ok(goals)
  } catch {
    return err('Erro ao listar metas', 500)
  }
}

const postSchema = z.object({
  name:        z.string().min(1),
  targetValue: z.number().positive(),
  unit:        z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Dados inválidos', 422)
    }

    const weekStart = getWeekStart()
    const goal = await prisma.goal.create({
      data: {
        name:         parsed.data.name,
        targetValue:  parsed.data.targetValue,
        unit:         parsed.data.unit,
        currentValue: 0,
        weekStartDate: weekStart,
      },
    })
    return ok(goal, 201)
  } catch {
    return err('Erro ao criar meta', 500)
  }
}
