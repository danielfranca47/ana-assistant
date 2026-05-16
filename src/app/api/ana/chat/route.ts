import { type NextRequest } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { ok, err, parseUTCDate } from '@/lib/api'

const chatSchema = z.object({
  message: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .optional(),
})

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

async function buscarContextoDia(): Promise<string> {
  const hoje = new Date()
  const hojeStr = toDateStr(hoje)
  const inicioHoje = parseUTCDate(hojeStr)
  const fimHoje = new Date(inicioHoje)
  fimHoje.setUTCDate(fimHoje.getUTCDate() + 1)
  const proximosSete = new Date(inicioHoje)
  proximosSete.setUTCDate(proximosSete.getUTCDate() + 7)

  const [tarefas, eventos] = await Promise.all([
    prisma.task.findMany({
      where: { date: { gte: inicioHoje, lt: fimHoje } },
      orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.event.findMany({
      where: { date: { gte: inicioHoje, lt: proximosSete } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    }),
  ])

  const linhasTarefas =
    tarefas.length === 0
      ? '  (nenhuma tarefa para hoje)'
      : tarefas
          .map((t) => {
            const horario = t.time ? ` às ${t.time}` : ''
            const dur = t.duration ? ` (${t.duration}min)` : ''
            return `  - [${t.status}] ${t.name}${horario}${dur} | prioridade: ${t.priority}`
          })
          .join('\n')

  const linhasEventos =
    eventos.length === 0
      ? '  (nenhum evento nos próximos 7 dias)'
      : eventos
          .map((e) => {
            const data = toDateStr(e.date)
            const horario =
              e.startTime && e.endTime
                ? ` das ${e.startTime} às ${e.endTime}`
                : e.startTime
                  ? ` às ${e.startTime}`
                  : ''
            const obs = e.notes ? ` — ${e.notes}` : ''
            return `  - ${data}: ${e.name}${horario} [${e.category}]${obs}`
          })
          .join('\n')

  return `## Tarefas de hoje (${hojeStr}):\n${linhasTarefas}\n\n## Eventos dos próximos 7 dias:\n${linhasEventos}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = chatSchema.safeParse(body)
    if (!parsed.success) {
      return err('Dados inválidos', 422)
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return err('ANTHROPIC_API_KEY não configurada', 500)
    }

    const { message, history = [] } = parsed.data
    const contexto = await buscarContextoDia()
    const systemPrompt = `Você é Ana, assistente pessoal de produtividade. Seja formal, profissional e responda sempre em português brasileiro.\n\n${contexto}\n\nAo responder, leve em conta as tarefas e eventos listados acima para dar orientações precisas e personalizadas.`

    const anthropic = new Anthropic({ apiKey })
    const messages: Anthropic.MessageParam[] = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const bloco = response.content[0]
    if (bloco.type !== 'text') {
      return err('Resposta inesperada da API Claude', 500)
    }

    return ok({ reply: bloco.text })
  } catch {
    return err('Erro interno', 500)
  }
}
