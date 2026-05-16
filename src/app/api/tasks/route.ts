import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, err, parseUTCDate } from '@/lib/api'

const createSchema = z.object({
  name: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().optional(),
  duration: z.number().int().positive().optional(),
  priority: z.enum(['alta', 'media', 'baixa']).optional(),
  category: z.string().optional(),
  status: z.enum(['pending', 'done', 'current', 'late']).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const date = searchParams.get('date') ?? undefined
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))

    const where: Record<string, unknown> = {}

    if (date) {
      const start = parseUTCDate(date)
      const end = new Date(start)
      end.setUTCDate(end.getUTCDate() + 1)
      where.date = { gte: start, lt: end }
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.task.count({ where }),
    ])

    return ok({ tasks, total, page, limit })
  } catch {
    return err('Erro interno', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return err('Dados inválidos', 422)
    }

    const { date, ...rest } = parsed.data
    const task = await prisma.task.create({
      data: { ...rest, date: parseUTCDate(date) },
    })

    return ok(task, 201)
  } catch {
    return err('Erro interno', 500)
  }
}
