import { PrismaClient, EventCategory } from '@prisma/client'
import { AppError } from '../middleware/errorHandler'

const prisma = new PrismaClient()

export interface CriarEventInput {
  name: string
  date: string // YYYY-MM-DD
  startTime?: string
  endTime?: string
  category?: EventCategory
  notes?: string
}

export interface AtualizarEventInput {
  name?: string
  date?: string // YYYY-MM-DD
  startTime?: string
  endTime?: string
  category?: EventCategory
  notes?: string
}

function parseUTCDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export async function listar(
  userId: string,
  from?: string,
  to?: string,
  page = 1,
  limit = 20,
) {
  const where: Record<string, unknown> = { userId }

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

  const skip = (page - 1) * limit

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.event.count({ where }),
  ])

  return { events, total }
}

export async function criar(userId: string, dados: CriarEventInput) {
  const { date, ...rest } = dados
  return prisma.event.create({
    data: { ...rest, date: parseUTCDate(date), userId },
  })
}

export async function atualizar(
  userId: string,
  id: string,
  dados: AtualizarEventInput,
) {
  const event = await prisma.event.findFirst({ where: { id, userId } })
  if (!event) {
    throw new AppError('Evento não encontrado', 404)
  }

  const { date, ...rest } = dados
  return prisma.event.update({
    where: { id },
    data: date ? { ...rest, date: parseUTCDate(date) } : rest,
  })
}

export async function deletar(userId: string, id: string): Promise<void> {
  const event = await prisma.event.findFirst({ where: { id, userId } })
  if (!event) {
    throw new AppError('Evento não encontrado', 404)
  }

  await prisma.event.delete({ where: { id } })
}
