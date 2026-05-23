import { type NextRequest } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { ok, err, parseUTCDate } from '@/lib/api'

const schema = z.object({
  taskName:        z.string().min(1),
  duration:        z.number().int().positive(),
  priority:        z.enum(['alta', 'media', 'baixa']),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredPeriod: z.enum(['manhã', 'tarde', 'qualquer']).default('qualquer'),
  excludeSlots:    z.array(z.object({ start: z.string(), end: z.string() })).optional(),
})

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function toHHMM(mins: number): string {
  return `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`
}

type Block = { start: number; end: number }

interface FreeSlot {
  start:       string
  end:         string
  durationMin: number
}

function calcFreeSlots(
  occupied:   Block[],
  workStart:  number,
  workEnd:    number,
  lunchStart: number,
  lunchEnd:   number,
): FreeSlot[] {
  const blocks = [...occupied, { start: lunchStart, end: lunchEnd }]
  blocks.sort((a, b) => a.start - b.start)

  const free: FreeSlot[] = []
  let cursor = workStart

  for (const block of blocks) {
    if (block.start > cursor) {
      const dur = block.start - cursor
      if (dur > 0) {
        free.push({ start: toHHMM(cursor), end: toHHMM(block.start), durationMin: dur })
      }
    }
    cursor = Math.max(cursor, block.end)
  }

  if (cursor < workEnd) {
    free.push({ start: toHHMM(cursor), end: toHHMM(workEnd), durationMin: workEnd - cursor })
  }

  return free
}

function filterByPeriod(slots: FreeSlot[], period: 'manhã' | 'tarde' | 'qualquer'): FreeSlot[] {
  if (period === 'qualquer') return slots

  const MANHA_FIM  = toMin('12:00')
  const TARDE_INI  = toMin('13:00')

  if (period === 'manhã') {
    return slots
      .filter((s) => toMin(s.start) < MANHA_FIM)
      .map((s) => {
        const endMin = Math.min(toMin(s.end), MANHA_FIM)
        const dur    = endMin - toMin(s.start)
        return { start: s.start, end: toHHMM(endMin), durationMin: dur }
      })
      .filter((s) => s.durationMin > 0)
  }

  // tarde
  return slots
    .filter((s) => toMin(s.end) > TARDE_INI)
    .map((s) => {
      const startMin = Math.max(toMin(s.start), TARDE_INI)
      const dur      = toMin(s.end) - startMin
      return { start: toHHMM(startMin), end: s.end, durationMin: dur }
    })
    .filter((s) => s.durationMin > 0)
}

function resolvePeriod(
  preferredPeriod: 'manhã' | 'tarde' | 'qualquer',
  focusTime:       string | undefined,
): 'manhã' | 'tarde' | 'qualquer' {
  if (preferredPeriod !== 'qualquer') return preferredPeriod
  if (focusTime === 'morning')   return 'manhã'
  if (focusTime === 'afternoon') return 'tarde'
  return 'qualquer'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Dados inválidos', 422)
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return err('ANTHROPIC_API_KEY não configurada', 500)

    const { taskName, duration, priority, date, preferredPeriod, excludeSlots = [] } = parsed.data

    const inicio = parseUTCDate(date)
    const fim    = new Date(inicio)
    fim.setUTCDate(fim.getUTCDate() + 1)

    const [tasks, events, prefs] = await Promise.all([
      prisma.task.findMany({ where: { date: { gte: inicio, lt: fim } } }),
      prisma.event.findMany({ where: { date: { gte: inicio, lt: fim } } }),
      prisma.userPreferences.findFirst(),
    ])

    const workStart  = toMin(prefs?.workStart  ?? '08:00')
    const workEnd    = toMin(prefs?.workEnd    ?? '18:00')
    const lunchStart = toMin(prefs?.lunchStart ?? '12:00')
    const lunchEnd   = toMin(prefs?.lunchEnd   ?? '13:00')
    const focusTime  = prefs?.focusTime

    const occupied: Block[] = []
    for (const t of tasks) {
      if (t.time && t.duration) {
        const s = toMin(t.time)
        occupied.push({ start: s, end: s + t.duration })
      }
    }
    for (const ev of events) {
      if (ev.startTime && ev.endTime) {
        occupied.push({ start: toMin(ev.startTime), end: toMin(ev.endTime) })
      }
    }

    const effectivePeriod = resolvePeriod(preferredPeriod, focusTime)

    let freeSlots = calcFreeSlots(occupied, workStart, workEnd, lunchStart, lunchEnd)
    freeSlots = filterByPeriod(freeSlots, effectivePeriod)
    freeSlots = freeSlots.filter((s) => s.durationMin >= duration)

    const excludedKeys = new Set(excludeSlots.map((s) => `${s.start}-${s.end}`))
    freeSlots = freeSlots.filter((s) => !excludedKeys.has(`${s.start}-${s.end}`))

    if (freeSlots.length === 0) {
      return ok(null)
    }

    const focusLabel = focusTime === 'afternoon' ? 'tarde' : 'manhã'

    const userPrompt =
      `Dados estes slots livres: ${JSON.stringify(freeSlots)}\n` +
      `Preferências do utilizador: início do trabalho ${toHHMM(workStart)}, foco preferido de ${focusLabel}.\n` +
      `Sugere o MELHOR slot para: "${taskName}" (${duration}min, prioridade ${priority})\n` +
      `Responde APENAS com JSON válido sem markdown:\n` +
      `{ "startTime": "HH:MM", "endTime": "HH:MM", "reason": "motivo em 1 frase" }`

    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 128,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const block = response.content[0]
    if (block.type !== 'text') return err('Resposta inesperada da API Claude', 500)

    const suggestion = JSON.parse(block.text.trim()) as {
      startTime: string
      endTime:   string
      reason:    string
    }

    return ok(suggestion)
  } catch (error) {
    console.error('[suggest-slot]', error)
    return err('Erro ao sugerir horário', 500)
  }
}
