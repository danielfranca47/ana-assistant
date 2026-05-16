import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api'

interface Meta {
  id: string
  name: string
  targetPct: number
}

async function lerMetas(): Promise<{ prefs: { id: string } | null; metas: Meta[] }> {
  const prefs = await prisma.userPreferences.findFirst()
  if (!prefs) return { prefs: null, metas: [] }
  try {
    const metas = JSON.parse(prefs.goalsJson) as Meta[]
    return { prefs, metas }
  } catch {
    return { prefs, metas: [] }
  }
}

async function persistirMetas(prefsId: string | null, metas: Meta[]) {
  const goalsJson = JSON.stringify(metas)
  if (prefsId) {
    await prisma.userPreferences.update({ where: { id: prefsId }, data: { goalsJson } })
  } else {
    await prisma.userPreferences.create({ data: { goalsJson } })
  }
}

export async function GET() {
  try {
    const { metas } = await lerMetas()
    return ok(metas)
  } catch {
    return err('Erro ao ler metas', 500)
  }
}

const postSchema = z.object({
  name:      z.string().min(1),
  targetPct: z.number().int().min(0).max(100).optional().default(0),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Dados inválidos', 422)
    }

    const { prefs, metas } = await lerMetas()
    const nova: Meta = {
      id:        crypto.randomUUID(),
      name:      parsed.data.name,
      targetPct: parsed.data.targetPct,
    }
    const novasMetas = [...metas, nova]
    await persistirMetas(prefs?.id ?? null, novasMetas)
    return ok(nova, 201)
  } catch {
    return err('Erro ao adicionar meta', 500)
  }
}
