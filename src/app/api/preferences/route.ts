import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api'

const prefsSchema = z.object({
  workStart:     z.string().optional(),
  workEnd:       z.string().optional(),
  lunchStart:    z.string().optional(),
  lunchEnd:      z.string().optional(),
  focusTime:     z.string().optional(),
  breakInterval: z.number().int().positive().optional(),
  offDays:       z.string().optional(),
  goalsJson:     z.string().optional(),
})

const DEFAULTS = {
  workStart:     '08:00',
  workEnd:       '18:00',
  lunchStart:    '12:00',
  lunchEnd:      '13:00',
  focusTime:     'morning',
  breakInterval: 60,
  offDays:       '6,0',
  goalsJson:     '[]',
}

export async function GET() {
  try {
    const prefs = await prisma.userPreferences.findFirst()
    return ok(prefs ?? DEFAULTS)
  } catch {
    return err('Erro ao ler preferências', 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = prefsSchema.safeParse(body)
    if (!parsed.success) {
      return err(parsed.issues[0]?.message ?? 'Dados inválidos', 422)
    }

    const data = parsed.data
    const existing = await prisma.userPreferences.findFirst()

    const prefs = existing
      ? await prisma.userPreferences.update({ where: { id: existing.id }, data })
      : await prisma.userPreferences.create({ data })

    return ok(prefs)
  } catch {
    return err('Erro ao guardar preferências', 500)
  }
}
