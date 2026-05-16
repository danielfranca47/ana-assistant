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

  const [tarefas, eventos, prefs] = await Promise.all([
    prisma.task.findMany({
      where: { date: { gte: inicioHoje, lt: fimHoje } },
      orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.event.findMany({
      where: { date: { gte: inicioHoje, lt: proximosSete } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.userPreferences.findFirst(),
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

  let linhasPrefs = ''
  if (prefs) {
    const focoLabel =
      prefs.focusTime === 'morning,afternoon' || prefs.focusTime === 'afternoon,morning'
        ? 'manhã e tarde'
        : prefs.focusTime === 'afternoon'
          ? 'tarde'
          : 'manhã'
    linhasPrefs = `\n\n## Preferências do utilizador:\nTrabalho das ${prefs.workStart} às ${prefs.workEnd}, almoço das ${prefs.lunchStart} às ${prefs.lunchEnd}. Foco profundo de ${focoLabel}. Folga nos dias ${prefs.offDays} (0=Dom, 1=Seg, ..., 6=Sáb).`
  }

  return `## Tarefas de hoje (${hojeStr}):\n${linhasTarefas}\n\n## Eventos dos próximos 7 dias:\n${linhasEventos}${linhasPrefs}`
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
    const systemPrompt = `Você é Ana, assistente pessoal de produtividade.
Seja formal, profissional e directa. Responda sempre
em português brasileiro. Nunca use markdown com asteriscos.
Seja concisa — máximo 3 parágrafos por resposta.
Você conhece as tarefas e eventos do utilizador listados abaixo
e deve usá-los para dar respostas contextualizadas.

${contexto}`

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
