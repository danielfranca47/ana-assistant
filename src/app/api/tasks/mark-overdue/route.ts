import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, err, parseUTCDate } from '@/lib/api'

export async function POST(_request: NextRequest) {
  try {
    const hojeStr = new Date().toISOString().split('T')[0]
    const inicioHoje = parseUTCDate(hojeStr)
    const fimHoje = new Date(inicioHoje)
    fimHoje.setUTCDate(fimHoje.getUTCDate() + 1)

    const tarefas = await prisma.task.findMany({
      where: {
        date: { gte: inicioHoje, lt: fimHoje },
        status: { in: ['pending', 'current'] },
      },
    })

    const agora = new Date()
    const minutoAtual = agora.getHours() * 60 + agora.getMinutes()

    const aAtualizar = tarefas.filter((t) => {
      if (!t.time) return false
      const [h, m] = t.time.split(':').map(Number)
      return h * 60 + m < minutoAtual
    })

    if (aAtualizar.length > 0) {
      await prisma.task.updateMany({
        where: { id: { in: aAtualizar.map((t) => t.id) } },
        data: { status: 'late' },
      })
    }

    return ok({ updated: aAtualizar.length })
  } catch {
    return err('Erro interno', 500)
  }
}
