import { type NextRequest } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { ok, err, parseUTCDate } from '@/lib/api'

const executeSchema = z.object({
  tool: z.enum(['criar_tarefa', 'criar_evento', 'actualizar_tarefa', 'gerar_relatorio']),
  input: z.record(z.unknown()),
  conversationId: z.string(),
})

const criarTarefaSchema = z.object({
  name: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().optional(),
  duration: z.number().int().positive().optional(),
  priority: z.enum(['alta', 'media', 'baixa']).default('media'),
  category: z.string().optional(),
})

const criarEventoSchema = z.object({
  name: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  category: z.enum(['work', 'meet', 'pers', 'break']).default('pers'),
  notes: z.string().optional(),
})

const actualizarTarefaSchema = z.object({
  taskId: z.string(),
  status: z.enum(['pending', 'done', 'current', 'late']).optional(),
  priority: z.enum(['alta', 'media', 'baixa']).optional(),
})

const gerarRelatorioSchema = z.object({
  done: z.string(),
  undone: z.string().optional(),
  notes: z.string().optional(),
})

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

async function salvarMensagemAna(conversationId: string, content: string) {
  await prisma.message.create({ data: { conversationId, role: 'assistant', content } })
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = executeSchema.safeParse(body)
    if (!parsed.success) {
      return err('Dados inválidos', 422)
    }

    const { tool, input, conversationId } = parsed.data

    if (tool === 'criar_tarefa') {
      const v = criarTarefaSchema.safeParse(input)
      if (!v.success) return err('Dados da tarefa inválidos', 422)
      const { date, ...rest } = v.data
      const task = await prisma.task.create({
        data: { ...rest, date: parseUTCDate(date) },
      })
      const message = `Tarefa "${task.name}" criada com sucesso para ${date}.`
      await salvarMensagemAna(conversationId, message)
      return ok({ success: true, result: task, message })
    }

    if (tool === 'criar_evento') {
      const v = criarEventoSchema.safeParse(input)
      if (!v.success) return err('Dados do evento inválidos', 422)
      const { date, ...rest } = v.data
      const event = await prisma.event.create({
        data: { ...rest, date: parseUTCDate(date) },
      })
      const message = `Evento "${event.name}" criado para ${date}.`
      await salvarMensagemAna(conversationId, message)
      return ok({ success: true, result: event, message })
    }

    if (tool === 'actualizar_tarefa') {
      const v = actualizarTarefaSchema.safeParse(input)
      if (!v.success) return err('Dados inválidos', 422)
      const { taskId, ...data } = v.data
      const task = await prisma.task.findUnique({ where: { id: taskId } })
      if (!task) return err('Tarefa não encontrada', 404)
      const updated = await prisma.task.update({ where: { id: taskId }, data })
      const message = `Tarefa "${updated.name}" actualizada com sucesso.`
      await salvarMensagemAna(conversationId, message)
      return ok({ success: true, result: updated, message })
    }

    if (tool === 'gerar_relatorio') {
      const v = gerarRelatorioSchema.safeParse(input)
      if (!v.success) return err('Dados do relatório inválidos', 422)

      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) return err('ANTHROPIC_API_KEY não configurada', 500)

      const { done, undone = '', notes = '' } = v.data
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
          : tarefas.map((t) => `  - [${t.status}] ${t.name}${t.time ? ` às ${t.time}` : ''}`).join('\n')

      const systemPrompt = `Você é Ana, assistente formal. Analise o relatório do dia e sugira de 3 a 5 acções concretas de rebalanceamento da rotina. Seja directa e prática. Português brasileiro, sem asteriscos.`
      const userPrompt = `Relatório do dia ${hojeStr}:\n\nTarefas:\n${linhasTarefas}\n\nConcluído: ${done}\nPendente: ${undone || '(não informado)'}\nObservações: ${notes || '(nenhuma)'}`

      const anthropic = new Anthropic({ apiKey })
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })
      const bloco = response.content[0]
      if (bloco.type !== 'text') return err('Resposta inesperada', 500)

      const suggestions = bloco.text
      const summary = `Concluído: ${done}\nPendente: ${undone}\nObservações: ${notes}`
      const report = await prisma.dailyReport.upsert({
        where: { date: inicioHoje },
        create: { date: inicioHoje, summary, aiAnalysis: suggestions },
        update: { summary, aiAnalysis: suggestions },
      })

      const message = `Relatório do dia gerado. ${suggestions.slice(0, 120)}...`
      await salvarMensagemAna(conversationId, message)
      return ok({ success: true, result: report, message })
    }

    return err('Ferramenta desconhecida', 400)
  } catch (error) {
    console.error('[ana/execute]', error)
    return err('Erro interno', 500)
  }
}
