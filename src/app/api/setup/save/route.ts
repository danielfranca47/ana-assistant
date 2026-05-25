export const runtime = 'nodejs'

import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, err } from '@/lib/api'

const schema = z.object({
  anthropicKey: z
    .string()
    .min(20, 'Chave demasiado curta')
    .refine((v) => v.startsWith('sk-ant-'), {
      message: 'A chave Anthropic deve começar com sk-ant-',
    }),
  openaiKey: z
    .string()
    .min(20, 'Chave demasiado curta')
    .refine((v) => v.startsWith('sk-'), {
      message: 'A chave OpenAI deve começar com sk-',
    }),
})

function updateEnvContent(key: string, value: string, content: string): string {
  const regex = new RegExp(`^${key}=.*$`, 'm')
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${value}`)
  }
  const sep = content.length > 0 && !content.endsWith('\n') ? '\n' : ''
  return content + sep + `${key}=${value}\n`
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return err('Corpo da requisição inválido', 400)
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Dados inválidos'
    return err(message, 422)
  }

  const { anthropicKey, openaiKey } = parsed.data

  try {
    if (process.env.IS_ELECTRON === 'true') {
      // Em Electron: actualizar env da sessão e notificar o processo main via IPC
      process.env.ANTHROPIC_API_KEY = anthropicKey
      process.env.OPENAI_API_KEY    = openaiKey
      // process.send existe porque o Next.js foi lançado com stdio IPC pelo Electron
      if (typeof (process as NodeJS.Process & { send?: (...args: unknown[]) => void }).send === 'function') {
        ;(process as NodeJS.Process & { send: (...args: unknown[]) => void }).send({
          type: 'save-api-keys',
          keys: { anthropic: anthropicKey, openai: openaiKey },
        })
      }
    } else {
      // Comportamento original: escrever no .env
      const envPath = path.join(process.cwd(), '.env')
      let content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : ''
      content = updateEnvContent('ANTHROPIC_API_KEY', anthropicKey, content)
      content = updateEnvContent('OPENAI_API_KEY', openaiKey, content)
      writeFileSync(envPath, content, 'utf-8')
      process.env.ANTHROPIC_API_KEY = anthropicKey
      process.env.OPENAI_API_KEY    = openaiKey
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao guardar as chaves'
    return err(msg, 500)
  }

  const response = ok({ success: true })
  // Cookie válido para a sessão corrente (para o middleware Edge ver a configuração)
  const res = NextResponse.json(
    await response.json(),
    { status: response.status },
  )
  res.cookies.set('setup_done', '1', {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
  })
  return res
}
