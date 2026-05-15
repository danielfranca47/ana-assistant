import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada')
  }
  return new Anthropic({ apiKey })
}

function parseUTCDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function buildSystemPrompt(contexto: string): string {
  return `Você é Ana, assistente pessoal de produtividade. Seja formal, profissional e responda sempre em português brasileiro.

${contexto}

Ao responder, leve em conta as tarefas e eventos listados acima para dar orientações precisas e personalizadas.`
}

async function buscarContextoDia(userId: string): Promise<string> {
  const hoje = new Date()
  const hojeStr = toDateStr(hoje)
  const inicioHoje = parseUTCDate(hojeStr)
  const fimHoje = new Date(inicioHoje)
  fimHoje.setUTCDate(fimHoje.getUTCDate() + 1)

  const proximosSete = new Date(inicioHoje)
  proximosSete.setUTCDate(proximosSete.getUTCDate() + 7)

  const [tarefas, eventos] = await Promise.all([
    prisma.task.findMany({
      where: { userId, date: { gte: inicioHoje, lt: fimHoje } },
      orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.event.findMany({
      where: { userId, date: { gte: inicioHoje, lt: proximosSete } },
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

export interface MensagemHistorico {
  role: 'user' | 'assistant'
  content: string
}

export async function chat(
  userId: string,
  message: string,
  history: MensagemHistorico[],
): Promise<string> {
  const anthropic = getAnthropicClient()
  const contexto = await buscarContextoDia(userId)
  const systemPrompt = buildSystemPrompt(contexto)

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
    throw new Error('Resposta inesperada da API Claude')
  }

  return bloco.text
}

export interface RebalanceInput {
  done: string
  undone: string
  notes: string
}

export async function rebalance(
  userId: string,
  dados: RebalanceInput,
): Promise<{ suggestions: string; reportId: string }> {
  const anthropic = getAnthropicClient()
  const hojeStr = toDateStr(new Date())
  const inicioHoje = parseUTCDate(hojeStr)
  const fimHoje = new Date(inicioHoje)
  fimHoje.setUTCDate(fimHoje.getUTCDate() + 1)

  const tarefas = await prisma.task.findMany({
    where: { userId, date: { gte: inicioHoje, lt: fimHoje } },
    orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
  })

  const linhasTarefas =
    tarefas.length === 0
      ? '(nenhuma)'
      : tarefas
          .map(
            (t) =>
              `  - [${t.status}] ${t.name}${t.time ? ` às ${t.time}` : ''}`,
          )
          .join('\n')

  const prompt = `Você é Ana, assistente pessoal de produtividade. Seja formal, profissional e responda sempre em português brasileiro.

O usuário enviou o seguinte relatório do dia (${hojeStr}):

**Tarefas da rotina registradas:**
${linhasTarefas}

**O que foi concluído:**
${dados.done || '(não informado)'}

**O que ficou pendente:**
${dados.undone || '(não informado)'}

**Observações do usuário:**
${dados.notes || '(nenhuma)'}

Com base nesse relatório, forneça sugestões concretas e objetivas para:
1. Reorganizar ou reprogramar as tarefas pendentes
2. Melhorar a produtividade nos próximos dias
3. Pontos de atenção identificados

Seja direto e prático nas sugestões.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const bloco = response.content[0]
  if (bloco.type !== 'text') {
    throw new Error('Resposta inesperada da API Claude')
  }

  const suggestions = bloco.text

  const summary = `Concluído: ${dados.done}\nPendente: ${dados.undone}\nObservações: ${dados.notes}`

  const report = await prisma.dailyReport.upsert({
    where: { userId_date: { userId, date: inicioHoje } },
    create: { userId, date: inicioHoje, summary, aiAnalysis: suggestions },
    update: { summary, aiAnalysis: suggestions },
  })

  return { suggestions, reportId: report.id }
}
