import { type NextRequest } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { ok, err, parseUTCDate } from '@/lib/api'

const rebalanceSchema = z.object({
  done: z.string().optional(),
  undone: z.string().optional(),
  notes: z.string().optional(),
})

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = rebalanceSchema.safeParse(body)
    if (!parsed.success) {
      return err('Dados inválidos', 422)
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return err('ANTHROPIC_API_KEY não configurada', 500)
    }

    const done = parsed.data.done ?? ''
    const undone = parsed.data.undone ?? ''
    const notes = parsed.data.notes ?? ''

    const hojeStr = toDateStr(new Date())
    const inicioHoje = parseUTCDate(hojeStr)
    const fimHoje = new Date(inicioHoje)
    fimHoje.setUTCDate(fimHoje.getUTCDate() + 1)

    const tarefas = await prisma.task.findMany({
      where: { date: { gte: inicioHoje, lt: fimHoje } },
      orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
    })

    const linhasTarefas =
      tarefas.length === 0
        ? '(nenhuma)'
        : tarefas
            .map((t) => `  - [${t.status}] ${t.name}${t.time ? ` às ${t.time}` : ''}`)
            .join('\n')

    const prompt = `Você é Ana, assistente pessoal de produtividade. Seja formal, profissional e responda sempre em português brasileiro.

O usuário enviou o seguinte relatório do dia (${hojeStr}):

**Tarefas da rotina registradas:**
${linhasTarefas}

**O que foi concluído:**
${done || '(não informado)'}

**O que ficou pendente:**
${undone || '(não informado)'}

**Observações do usuário:**
${notes || '(nenhuma)'}

Com base nesse relatório, forneça sugestões concretas e objetivas para:
1. Reorganizar ou reprogramar as tarefas pendentes
2. Melhorar a produtividade nos próximos dias
3. Pontos de atenção identificados

Seja direto e prático nas sugestões.`

    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const bloco = response.content[0]
    if (bloco.type !== 'text') {
      return err('Resposta inesperada da API Claude', 500)
    }

    const suggestions = bloco.text
    const summary = `Concluído: ${done}\nPendente: ${undone}\nObservações: ${notes}`

    const report = await prisma.dailyReport.upsert({
      where: { date: inicioHoje },
      create: { date: inicioHoje, summary, aiAnalysis: suggestions },
      update: { summary, aiAnalysis: suggestions },
    })

    return ok({ suggestions, reportId: report.id })
  } catch {
    return err('Erro interno', 500)
  }
}
