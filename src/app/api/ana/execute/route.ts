import { type NextRequest } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { ok, err, parseUTCDate } from '@/lib/api'

const executeSchema = z.object({
  tool: z.enum(['criar_tarefa', 'criar_multiplas_tarefas', 'criar_tarefa_recorrente', 'criar_evento', 'actualizar_tarefa', 'gerar_relatorio', 'registrar_contexto']),
  input: z.record(z.string(), z.unknown()),
  conversationId: z.string(),
})

const criarTarefaSchema = z.object({
  name: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional(),
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
  description: z.string().optional(),
  status: z.enum(['pending', 'done', 'current', 'late']).optional(),
  priority: z.enum(['alta', 'media', 'baixa']).optional(),
})

const gerarRelatorioSchema = z.object({
  done: z.string(),
  undone: z.string().optional(),
  notes: z.string().optional(),
})

const itemTarefaSchema = z.object({
  name: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional(),
  time: z.string().optional(),
  duration: z.number().int().positive().optional(),
  priority: z.enum(['alta', 'media', 'baixa']).default('media'),
  category: z.string().optional(),
})

const criarMultiplasTarefasSchema = z.object({
  tarefas: z.array(itemTarefaSchema).min(1),
})

const activitySchema = z.object({
  name: z.string(),
  frequency: z.string().optional(),
})
const projetoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['alta', 'media', 'baixa']).default('media'),
  activities: z.array(activitySchema).optional(),
})
const objetivoSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  horizon: z.enum(['1m', '3m', '6m', '1y', '5y']),
})
const registrarContextoSchema = z.object({
  projetos: z.array(projetoSchema).optional(),
  objetivos: z.array(objetivoSchema).optional(),
})

const criarTarefaRecorrenteSchema = z.object({
  name: z.string().min(1),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dias_semana: z.array(z.number().int().min(0).max(6)).optional(),
  time: z.string().optional(),
  duration: z.number().int().positive().optional(),
  priority: z.enum(['alta', 'media', 'baixa']).default('media'),
  category: z.string().optional(),
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

    if (tool === 'criar_multiplas_tarefas') {
      const v = criarMultiplasTarefasSchema.safeParse(input)
      if (!v.success) return err('Dados das tarefas inválidos', 422)
      const criadas = await Promise.all(
        v.data.tarefas.map(({ date, ...rest }) =>
          prisma.task.create({ data: { ...rest, date: parseUTCDate(date) } })
        )
      )
      const nomes = criadas.map((t) => `"${t.name}"`).join(', ')
      const message = `${criadas.length} tarefas criadas com sucesso: ${nomes}.`
      await salvarMensagemAna(conversationId, message)
      return ok({ success: true, result: criadas, message })
    }

    if (tool === 'criar_tarefa_recorrente') {
      const v = criarTarefaRecorrenteSchema.safeParse(input)
      if (!v.success) return err('Dados da tarefa recorrente inválidos', 422)
      const { name, data_inicio, data_fim, dias_semana, time, duration, priority, category } = v.data

      const inicio = parseUTCDate(data_inicio)
      const fim = parseUTCDate(data_fim)
      if (fim < inicio) return err('data_fim deve ser igual ou posterior a data_inicio', 422)

      const diasPermitidos = new Set(dias_semana ?? [0, 1, 2, 3, 4, 5, 6])
      const datas: Date[] = []
      const cursor = new Date(inicio)
      while (cursor <= fim) {
        if (diasPermitidos.has(cursor.getUTCDay())) {
          datas.push(new Date(cursor))
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }

      if (datas.length === 0) return err('Nenhum dia válido no intervalo especificado', 422)

      // Criar primeiro elemento para obter o id que serve de parentId do grupo
      const primeiro = await prisma.task.create({
        data: { name, time, duration, priority, category, date: datas[0] },
      })
      const grupoId = primeiro.id
      // Auto-referenciar o primeiro como parte da série
      await prisma.task.update({ where: { id: grupoId }, data: { parentId: grupoId } })

      const restantes = await Promise.all(
        datas.slice(1).map((date) =>
          prisma.task.create({ data: { name, time, duration, priority, category, date, parentId: grupoId } })
        )
      )
      const criadas = [{ ...primeiro, parentId: grupoId }, ...restantes]
      const message = `Tarefa "${name}" criada para ${criadas.length} dias (de ${data_inicio} a ${data_fim}).`
      await salvarMensagemAna(conversationId, message)
      return ok({ success: true, result: criadas, message })
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

    if (tool === 'registrar_contexto') {
      const v = registrarContextoSchema.safeParse(input)
      if (!v.success) return err('Dados de contexto inválidos', 422)

      const projetosCriados = v.data.projetos?.length
        ? await Promise.all(
            v.data.projetos.map((p) =>
              prisma.project.create({
                data: {
                  name:        p.name,
                  description: p.description ?? null,
                  priority:    p.priority,
                  activities:  JSON.stringify(p.activities ?? []),
                },
              })
            )
          )
        : []

      const objetivosCriados = v.data.objetivos?.length
        ? await Promise.all(
            v.data.objetivos.map((o) =>
              prisma.objective.create({
                data: {
                  title:       o.title,
                  description: o.description ?? null,
                  horizon:     o.horizon,
                },
              })
            )
          )
        : []

      const message = `Contexto registado: ${projetosCriados.length} projeto(s) e ${objetivosCriados.length} objetivo(s) guardados com sucesso.`
      await salvarMensagemAna(conversationId, message)
      return ok({ success: true, message })
    }

    return err('Ferramenta desconhecida', 400)
  } catch (error) {
    console.error('[ana/execute]', error)
    return err('Erro interno', 500)
  }
}
