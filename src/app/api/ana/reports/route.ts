import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '5', 10), 20)

    const reports = await prisma.dailyReport.findMany({
      orderBy: { date: 'desc' },
      take: limit,
      select: { id: true, date: true, summary: true, aiAnalysis: true, createdAt: true },
    })

    return ok(reports)
  } catch {
    return err('Erro ao carregar relatórios', 500)
  }
}
