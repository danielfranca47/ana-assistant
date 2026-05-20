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
        name:        { type: 'string', description: 'Nome da tarefa' },
        date:        { type: 'string', description: 'Data YYYY-MM-DD' },
        description: { type: 'string', description: 'Descrição detalhada da tarefa (opcional)' },
        time:        { type: 'string', description: 'Horário HH:MM' },
        duration:    { type: 'number', description: 'Duração em minutos' },
        priority:    { type: 'string', enum: ['alta', 'media', 'baixa'] },
        category:    { type: 'string' },
      },
      required: ['name', 'date', 'priority'],
    },
  },
  {
    name: 'criar_multiplas_tarefas',
    description: 'Cria várias tarefas de uma só vez. Usar quando o utilizador pede mais de uma tarefa no mesmo pedido.',
    input_schema: {
      type: 'object',
      properties: {
        tarefas: {
          type: 'array',
          description: 'Lista de tarefas a criar',
          items: {
            type: 'object',
            properties: {
              name:        { type: 'string', description: 'Nome da tarefa' },
              date:        { type: 'string', description: 'Data YYYY-MM-DD' },
              description: { type: 'string', description: 'Descrição detalhada da tarefa (opcional)' },
              time:        { type: 'string', description: 'Horário HH:MM' },
              duration:    { type: 'number', description: 'Duração em minutos' },
              priority:    { type: 'string', enum: ['alta', 'media', 'baixa'] },
              category:    { type: 'string' },
            },
            required: ['name', 'date', 'priority'],
          },
        },
      },
      required: ['tarefas'],
    },
  },
  {
    name: 'criar_tarefa_recorrente',
    description: 'Cria a mesma tarefa em múltiplos dias consecutivos (ex: de segunda a sexta durante uma semana). Usar quando o utilizador pede uma rotina diária ou tarefa repetida num intervalo de datas.',
    input_schema: {
      type: 'object',
      properties: {
        name:        { type: 'string', description: 'Nome da tarefa' },
        data_inicio: { type: 'string', description: 'Data de início YYYY-MM-DD' },
        data_fim:    { type: 'string', description: 'Data de fim YYYY-MM-DD (inclusive)' },
        dias_semana: {
          type: 'array',
          description: 'Dias da semana a incluir: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb. Omitir para incluir todos os dias.',
          items: { type: 'number' },
        },
        time:     { type: 'string', description: 'Horário HH:MM' },
        duration: { type: 'number', description: 'Duração em minutos' },
        priority: { type: 'string', enum: ['alta', 'media', 'baixa'] },
        category: { type: 'string' },
      },
      required: ['name', 'data_inicio', 'data_fim', 'priority'],
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
    description: 'Actualiza o status, prioridade ou descrição de uma tarefa existente pelo ID',
    input_schema: {
      type: 'object',
      properties: {
        taskId:      { type: 'string' },
        description: { type: 'string', description: 'Nova descrição da tarefa' },
        status:      { type: 'string', enum: ['pending', 'done', 'current', 'late'] },
        priority:    { type: 'string', enum: ['alta', 'media', 'baixa'] },
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
  {
    name: 'registrar_contexto',
    description: 'Guarda permanentemente os projetos e/ou objetivos que o utilizador descreveu, para usar como contexto futuro. Usar quando o utilizador partilha informação sobre os seus projetos, metas ou objetivos que ainda não estão registados.',
    input_schema: {
      type: 'object',
      properties: {
        projetos: {
          type: 'array',
          description: 'Lista de projetos a registar',
          items: {
            type: 'object',
            properties: {
              name:        { type: 'string', description: 'Nome do projeto' },
              description: { type: 'string', description: 'Descrição do projeto' },
              priority:    { type: 'string', enum: ['alta', 'media', 'baixa'], description: 'Prioridade estratégica' },
              activities: {
                type: 'array',
                description: 'Atividades recorrentes deste projeto',
                items: {
                  type: 'object',
                  properties: {
                    name:      { type: 'string' },
                    frequency: { type: 'string' },
                  },
                  required: ['name'],
                },
              },
            },
            required: ['name', 'priority'],
          },
        },
        objetivos: {
          type: 'array',
          description: 'Lista de objetivos/metas a registar',
          items: {
            type: 'object',
            properties: {
              title:       { type: 'string', description: 'Título do objetivo' },
              description: { type: 'string', description: 'Descrição detalhada' },
              horizon:     { type: 'string', enum: ['1m', '3m', '6m', '1y', '5y'], description: 'Horizonte temporal' },
            },
            required: ['title', 'horizon'],
          },
        },
      },
    },
  },
]

const TOOLS_ESCRITA = new Set(['criar_tarefa', 'criar_multiplas_tarefas', 'criar_tarefa_recorrente', 'criar_evento', 'actualizar_tarefa', 'gerar_relatorio', 'registrar_contexto'])

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

  const [tarefas, eventos, prefs, projetos, objetivos] = await Promise.all([
    prisma.task.findMany({
      where: { date: { gte: inicioHoje, lt: fimHoje } },
      orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.event.findMany({
      where: { date: { gte: inicioHoje, lt: proximosSete } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.userPreferences.findFirst(),
    prisma.project.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.objective.findMany({ where: { status: 'active' }, orderBy: { createdAt: 'asc' } }),
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

  let linhasProjetos = ''
  if (projetos.length > 0) {
    const linhas = projetos.map((p) => {
      let activities: { name: string; frequency: string }[] = []
      try { activities = JSON.parse(p.activities) } catch { /* */ }
      const actStr = activities.length > 0
        ? `\n    Atividades: ${activities.map((a) => `${a.name}${a.frequency ? ` (${a.frequency})` : ''}`).join(', ')}`
        : ''
      const desc = p.description ? ` — ${p.description}` : ''
      return `  - ${p.name} [prioridade: ${p.priority}]${desc}${actStr}`
    }).join('\n')
    linhasProjetos = `\n\n## Projetos do utilizador:\n${linhas}`
  }

  let linhasObjetivos = ''
  if (objetivos.length > 0) {
    const horizonLabels: Record<string, string> = { '1m': 'Próximo mês', '3m': '3 meses', '6m': '6 meses', '1y': '1 ano', '5y': '5 anos' }
    const grupos: Record<string, string[]> = {}
    for (const o of objetivos) {
      const label = horizonLabels[o.horizon] ?? o.horizon
      if (!grupos[label]) grupos[label] = []
      const det = o.description ? ` — ${o.description}` : ''
      grupos[label].push(`${o.title}${det}`)
    }
    const linhas = Object.entries(grupos)
      .map(([label, items]) => `  ${label}: ${items.join(' | ')}`)
      .join('\n')
    linhasObjetivos = `\n\n## Objetivos do utilizador:\n${linhas}`
  }

  return `## Tarefas de hoje (${hojeStr}):\n${linhasTarefas}\n\n## Eventos dos próximos 7 dias:\n${linhasEventos}${linhasPrefs}${linhasProjetos}${linhasObjetivos}`
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
Ao chamar uma ferramenta de escrita (criar_tarefa, criar_multiplas_tarefas, criar_tarefa_recorrente, criar_evento, actualizar_tarefa, gerar_relatorio, registrar_contexto),
inclui SEMPRE um bloco de texto ANTES da chamada de ferramenta a descrever o que vais fazer
e a pedir confirmação ao utilizador. Chama a ferramenta no mesmo turno — o sistema trata da aprovação.
REGRA CRÍTICA — FERRAMENTA registrar_contexto:
Quando o utilizador partilhar dados de projetos, metas ou objetivos — mesmo que descrevendo vários de uma vez ou numa mensagem longa de contexto —, CHAMA OBRIGATORIAMENTE a ferramenta "registrar_contexto" no mesmo turno, com TODOS os dados fornecidos.
É PROIBIDO responder com texto dizendo "vou registar", "registarei agora", "vou guardar" ou qualquer variação SEM ter chamado a ferramenta no mesmo turno. Responder apenas com texto sem chamar a ferramenta deixa os dados perdidos para sempre — isso é um erro crítico irrecuperável.`

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
