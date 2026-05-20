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
  recurrence: z.enum(['daily', 'weekly', 'weekdays', 'custom']).optional(),
  recurrenceDays: z.string().optional(), // JSON "[0,1,2]"
  recurrenceEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

function gerarOcorrencias(
  parentDate: Date,
  recurrence: string,
  days: number[] | null,
  endDate: Date,
): Date[] {
  const parentDow = parentDate.getUTCDay()
  const allowed = new Set<number>(
    recurrence === 'daily'    ? [0, 1, 2, 3, 4, 5, 6] :
    recurrence === 'weekly'   ? [parentDow] :
    recurrence === 'weekdays' ? [1, 2, 3, 4, 5] :
    recurrence === 'custom'   ? (days ?? []) : [],
  )
  const dates: Date[] = []
  const cur = new Date(parentDate)
  cur.setUTCDate(cur.getUTCDate() + 1)
  while (cur <= endDate && dates.length < 200) {
    if (allowed.has(cur.getUTCDay())) dates.push(new Date(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

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

    const { date, recurrence, recurrenceDays, recurrenceEnd, ...rest } = parsed.data
    const parentDate = parseUTCDate(date)

    // Sem recorrência — comportamento original, retorna array de 1
    if (!recurrence) {
      const event = await prisma.event.create({
        data: { ...rest, date: parentDate },
      })
      return ok([event], 201)
    }

    // Com recorrência — cria pai + ocorrências
    const endDate = recurrenceEnd
      ? parseUTCDate(recurrenceEnd)
      : new Date(Date.UTC(
          parentDate.getUTCFullYear(),
          parentDate.getUTCMonth(),
          parentDate.getUTCDate() + 90,
        ))

    const recurrenceDaysParsed: number[] | null = recurrenceDays
      ? (JSON.parse(recurrenceDays) as number[])
      : null

    const parent = await prisma.event.create({
      data: {
        ...rest,
        date: parentDate,
        recurrence,
        recurrenceDays: recurrenceDays ?? null,
        recurrenceEnd: endDate,
      },
    })

    const datas = gerarOcorrencias(parentDate, recurrence, recurrenceDaysParsed, endDate)

    if (datas.length > 0) {
      await prisma.event.createMany({
        data: datas.map(d => ({
          ...rest,
          date: d,
          recurrence,
          recurrenceDays: recurrenceDays ?? null,
          recurrenceEnd: endDate,
          parentId: parent.id,
        })),
      })
    }

    const todos = await prisma.event.findMany({
      where: { OR: [{ id: parent.id }, { parentId: parent.id }] },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    })

    return ok(todos, 201)
  } catch {
    return err('Erro interno', 500)
  }
}
