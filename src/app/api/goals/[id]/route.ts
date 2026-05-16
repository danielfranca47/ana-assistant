import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api'

interface Meta {
  id: string
  name: string
  targetPct: number
}

async function lerEstado(): Promise<{ prefsId: string | null; metas: Meta[] }> {
  const prefs = await prisma.userPreferences.findFirst()
  if (!prefs) return { prefsId: null, metas: [] }
  try {
    return { prefsId: prefs.id, metas: JSON.parse(prefs.goalsJson) as Meta[] }
  } catch {
    return { prefsId: prefs.id, metas: [] }
  }
}

async function persistir(prefsId: string | null, metas: Meta[]) {
  const goalsJson = JSON.stringify(metas)
  if (prefsId) {
    await prisma.userPreferences.update({ where: { id: prefsId }, data: { goalsJson } })
  } else {
    await prisma.userPreferences.create({ data: { goalsJson } })
  }
}

const patchSchema = z.object({
  name:      z.string().min(1).optional(),
  targetPct: z.number().int().min(0).max(100).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return err(parsed.issues[0]?.message ?? 'Dados inválidos', 422)
    }

    const { prefsId, metas } = await lerEstado()
    const idx = metas.findIndex((m) => m.id === id)
    if (idx === -1) return err('Meta não encontrada', 404)

    metas[idx] = { ...metas[idx], ...parsed.data }
    await persistir(prefsId, metas)
    return ok(metas[idx])
  } catch {
    return err('Erro ao actualizar meta', 500)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { prefsId, metas } = await lerEstado()
    const novasMetas = metas.filter((m) => m.id !== id)
    if (novasMetas.length === metas.length) return err('Meta não encontrada', 404)
    await persistir(prefsId, novasMetas)
    return ok(null)
  } catch {
    return err('Erro ao remover meta', 500)
  }
}
