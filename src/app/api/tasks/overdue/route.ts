import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, err, parseUTCDate } from '@/lib/api'

export async function GET(_request: NextRequest) {
  try {
    const hojeStr = new Date().toISOString().split('T')[0]
    const fimHoje = new Date(parseUTCDate(hojeStr))
    fimHoje.setUTCDate(fimHoje.getUTCDate() + 1)

    const tarefas = await prisma.task.findMany({
      where: {
        date: { lt: fimHoje },
        status: 'late',
      },
      orderBy: { date: 'asc' },
    })

    return ok({ tasks: tarefas })
  } catch {
    return err('Erro interno', 500)
  }
}
