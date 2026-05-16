import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, err, parseUTCDate } from '@/lib/api'

const createSchema = z.object({
  name: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  category: z.enum(['work', 'meet', 'pers', 'break']).optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const from = searchParams.get('from') ?? undefined
    const to = searchParams.get('to') ?? undefined

    const where: Record<string, unknown> = {}

    if (from || to) {
      const filtroData: Record<string, Date> = {}
      if (from) filtroData.gte = parseUTCDate(from)
      if (to) {
        const fim = parseUTCDate(to)
        fim.setUTCDate(fim.getUTCDate() + 1)
        filtroData.lt = fim
      }
      where.date = filtroData
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    })

    return ok(events)
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
    const event = await prisma.event.create({
      data: { ...rest, date: parseUTCDate(date) },
    })

    return ok(event, 201)
  } catch {
    return err('Erro interno', 500)
  }
}
