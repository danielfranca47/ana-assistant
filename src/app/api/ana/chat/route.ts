import { type NextRequest } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { ok, err, parseUTCDate } from '@/lib/api'

const chatSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
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

async function gerarTitulo(anthropic: Anthropic, mensagem: string): Promise<string> {
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [{ role: 'user', content: `Resume em até 4 palavras o tema desta mensagem (sem pontuação, sem aspas): ${mensagem}` }],
    })
    const bloco = resp.content[0]
    return bloco.type === 'text' ? bloco.text.trim() : 'Nova conversa'
  } catch {
    return 'Nova conversa'
  }
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

    const { message, conversationId: convIdEntrada } = parsed.data
    const anthropic = new Anthropic({ apiKey })

    // Obter ou criar conversa
    let conversa = convIdEntrada
      ? await prisma.conversation.findUnique({
          where: { id: convIdEntrada },
          include: { messages: { orderBy: { createdAt: 'asc' } } },
        })
      : null

    if (!conversa) {
      conversa = await prisma.conversation.create({
        data: {},
        include: { messages: true },
      })
    }

    const conversationId = conversa.id

    // Guardar mensagem do utilizador
    await prisma.message.create({
      data: { conversationId, role: 'user', content: message },
    })

    // Construir histórico para a API (mensagens já guardadas + nova)
    const historyMessages: Anthropic.MessageParam[] = conversa.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
    historyMessages.push({ role: 'user', content: message })

    const contexto = await buscarContextoDia()
    const systemPrompt = `Você é Ana, assistente pessoal de produtividade.
Seja formal, profissional e directa. Responda sempre
em português brasileiro. Nunca use markdown com asteriscos.
Seja concisa — máximo 3 parágrafos por resposta.
Você conhece as tarefas e eventos do utilizador listados abaixo
e deve usá-los para dar respostas contextualizadas.

${contexto}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: historyMessages,
    })

    const bloco = response.content[0]
    if (bloco.type !== 'text') {
      return err('Resposta inesperada da API Claude', 500)
    }

    const reply = bloco.text

    // Guardar resposta da Ana
    await prisma.message.create({
      data: { conversationId, role: 'assistant', content: reply },
    })

    // Actualizar updatedAt da conversa
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    // Gerar título na primeira mensagem da conversa
    if (conversa.messages.length === 0) {
      const titulo = await gerarTitulo(anthropic, message)
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title: titulo },
      })
    }

    return ok({ reply, conversationId })
  } catch (error) {
    console.error('[ana/chat]', error)
    return err('Erro interno', 500)
  }
}
