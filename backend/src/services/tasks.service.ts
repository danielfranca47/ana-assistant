import { PrismaClient, TaskPriority, TaskStatus } from '@prisma/client'
import { AppError } from '../middleware/errorHandler'

const prisma = new PrismaClient()

export interface CriarTaskInput {
  name: string
  date: string // YYYY-MM-DD
  time?: string
  duration?: number
  priority?: TaskPriority
  category?: string
  status?: TaskStatus
}

export interface AtualizarTaskInput {
  name?: string
  time?: string
  duration?: number
  priority?: TaskPriority
  category?: string
  status?: TaskStatus
}

function parseUTCDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export async function listar(userId: string, date?: string) {
  const where: Record<string, unknown> = { userId }

  if (date) {
    const inicio = parseUTCDate(date)
    const fim = new Date(inicio)
    fim.setUTCDate(fim.getUTCDate() + 1)
    where.date = { gte: inicio, lt: fim }
  }

  return prisma.task.findMany({
    where,
    orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
  })
}

export async function criar(userId: string, dados: CriarTaskInput) {
  const { date, ...rest } = dados
  return prisma.task.create({
    data: { ...rest, date: parseUTCDate(date), userId },
  })
}

export async function atualizar(
  userId: string,
  id: string,
  dados: AtualizarTaskInput,
) {
  const task = await prisma.task.findFirst({ where: { id, userId } })
  if (!task) {
    throw new AppError('Tarefa não encontrada', 404)
  }

  return prisma.task.update({ where: { id }, data: dados })
}

export async function deletar(userId: string, id: string): Promise<void> {
  const task = await prisma.task.findFirst({ where: { id, userId } })
  if (!task) {
    throw new AppError('Tarefa não encontrada', 404)
  }

  await prisma.task.delete({ where: { id } })
}
