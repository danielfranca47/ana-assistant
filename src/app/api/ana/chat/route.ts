import { type NextRequest } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import type { Tool } from '@anthropic-ai/sdk/resources'
import { prisma } from '@/lib/prisma'
import { ok, err, parseUTCDate } from '@/lib/api'

const chatSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
})

const TOOLS: Tool[] = [
  {
    name: 'criar_tarefa',
    description: 'Cria uma tarefa na rotina do utilizador',
    input_schema: {
      type: 'object',
      properties: {
        name:     { type: 'string', description: 'Nome da tarefa' },
        date:     { type: 'string', description: 'Data YYYY-MM-DD' },
        time:     { type: 'string', description: 'Horário HH:MM' },
        duration: { type: 'number', description: 'Duração em minutos' },
        priority: { type: 'string', enum: ['alta', 'media', 'baixa'] },
        category: { type: 'string' },
      },
      required: ['name', 'date', 'priority'],
    },
  },
  {
    name: 'criar_evento',
    description: 'Cria um evento no calendário do utilizador',
    input_schema: {
      type: 'object',
      properties: {
        name:      { type: 'string' },
        date:      { type: 'string', description: 'Data YYYY-MM-DD' },
        startTime: { type: 'string', description: 'Hora início HH:MM' },
        endTime:   { type: 'string', description: 'Hora fim HH:MM' },
        category:  { type: 'string', enum: ['work', 'meet', 'pers', 'break'] },
        notes:     { type: 'string' },
      },
      required: ['name', 'date', 'startTime', 'category'],
    },
  },
  {
    name: 'listar_tarefas',
    description: 'Lista as tarefas do utilizador numa data específica',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Data YYYY-MM-DD. Para hoje, usar a data actual.' },
      },
      required: ['date'],
    },
  },
  {
    name: 'actualizar_tarefa',
    description: 'Actualiza o status ou prioridade de uma tarefa existente pelo ID',
    input_schema: {
      type: 'object',
      properties: {
        taskId:   { type: 'string' },
        status:   { type: 'string', enum: ['pending', 'done', 'current', 'late'] },
        priority: { type: 'string', enum: ['alta', 'media', 'baixa'] },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'gerar_relatorio',
    description: 'Gera um relatório do dia com sugestões de rebalanceamento',
    input_schema: {
      type: 'object',
      properties: {
        done:   { type: 'string', description: 'O que o utilizador fez hoje' },
        undone: { type: 'string', description: 'O que não conseguiu fazer' },
        notes:  { type: 'string', description: 'Observações adicionais' },
      },
      required: ['done'],
    },
  },
]

const TOOLS_ESCRITA = new Set(['criar_tarefa', 'criar_evento', 'actualizar_tarefa', 'gerar_relatorio'])

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
            return `  - [${t.status}] ${t.name}${horario}${dur} | prioridade: ${t.priority} | id: ${t.id}`
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

async function actualizarConversa(
  conversationId: string,
  isPrimeira: boolean,
  anthropic: Anthropic,
  primeiroMsg: string,
) {
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
  if (isPrimeira) {
    const titulo = await gerarTitulo(anthropic, primeiroMsg)
    await prisma.conversation.update({ where: { id: conversationId }, data: { title: titulo } })
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
    const isPrimeira = conversa.messages.length === 0

    // Guardar mensagem do utilizador
    await prisma.message.create({
      data: { conversationId, role: 'user', content: message },
    })

    // Mesclar mensagens consecutivas do mesmo role (necessário para Anthropic API)
    const dbMessages = conversa.messages
    const merged: { role: string; content: string }[] = []
    for (const m of dbMessages) {
      const prev = merged[merged.length - 1]
      if (prev && prev.role === m.role) {
        prev.content += '\n\n' + m.content
      } else {
        merged.push({ role: m.role, content: m.content })
      }
    }
    const historyMessages: Anthropic.MessageParam[] = merged.map((m) => ({
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

${contexto}

Quando precisares de criar tarefas ou eventos, usa as ferramentas disponíveis.
Para "listar_tarefas", usa sempre a data actual se o utilizador pedir "hoje".
Ao chamar uma ferramenta de escrita (criar_tarefa, criar_evento, actualizar_tarefa, gerar_relatorio),
inclui SEMPRE um bloco de texto ANTES da chamada de ferramenta a descrever o que vais fazer
e a pedir confirmação ao utilizador.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: historyMessages,
      tools: TOOLS,
    })

    if (response.stop_reason === 'tool_use') {
      const toolBlock = response.content.find((b) => b.type === 'tool_use')
      const textBlock = response.content.find((b) => b.type === 'text')

      if (!toolBlock || toolBlock.type !== 'tool_use') {
        return err('Resposta inesperada da API Claude', 500)
      }

      // Leitura — executa imediatamente e faz segunda chamada
      if (toolBlock.name === 'listar_tarefas') {
        const input = toolBlock.input as { date: string }
        const inicio = parseUTCDate(input.date)
        const fim = new Date(inicio)
        fim.setUTCDate(fim.getUTCDate() + 1)
        const tarefas = await prisma.task.findMany({
          where: { date: { gte: inicio, lt: fim } },
          orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
        })
        const toolResult =
          tarefas.length === 0
            ? 'Nenhuma tarefa encontrada.'
            : tarefas.map((t) => `[${t.id}] ${t.name}${t.time ? ` às ${t.time}` : ''} [${t.status}]`).join('\n')

        const response2 = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            ...historyMessages,
            { role: 'assistant', content: response.content },
            { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: toolResult }] },
          ],
          tools: TOOLS,
        })
        const bloco2 = response2.content.find((b) => b.type === 'text')
        const reply = bloco2?.type === 'text' ? bloco2.text : toolResult
        await prisma.message.create({ data: { conversationId, role: 'assistant', content: reply } })
        await actualizarConversa(conversationId, isPrimeira, anthropic, message)
        return ok({ reply, conversationId })
      }

      // Escrita — pede confirmação ao utilizador
      if (TOOLS_ESCRITA.has(toolBlock.name)) {
        const confirmacaoText =
          textBlock?.type === 'text' ? textBlock.text : `Confirmas a acção "${toolBlock.name}"?`
        await prisma.message.create({ data: { conversationId, role: 'assistant', content: confirmacaoText } })
        await actualizarConversa(conversationId, isPrimeira, anthropic, message)
        return ok({
          reply: confirmacaoText,
          conversationId,
          pendingAction: {
            tool: toolBlock.name,
            input: toolBlock.input as Record<string, unknown>,
          },
        })
      }
    }

    // Resposta de texto normal
    const bloco = response.content.find((b) => b.type === 'text')
    if (!bloco || bloco.type !== 'text') {
      return err('Resposta inesperada da API Claude', 500)
    }

    const reply = bloco.text
    await prisma.message.create({ data: { conversationId, role: 'assistant', content: reply } })
    await actualizarConversa(conversationId, isPrimeira, anthropic, message)
    return ok({ reply, conversationId })
  } catch (error) {
    console.error('[ana/chat]', error)
    return err('Erro interno', 500)
  }
}
