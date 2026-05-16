import { type NextRequest } from 'next/server'
import OpenAI, { toFile } from 'openai'
import { ok, err } from '@/lib/api'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return err('OPENAI_API_KEY não configurada', 500)
    }

    const formData = await request.formData()
    const audio = formData.get('audio')
    if (!audio || !(audio instanceof File)) {
      return err('Campo "audio" obrigatório', 422)
    }

    const buffer = Buffer.from(await audio.arrayBuffer())
    const file = await toFile(buffer, audio.name || 'audio.webm', {
      type: audio.type || 'audio/webm',
    })

    const openai = new OpenAI({ apiKey })
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'pt',
    })

    return ok({ transcript: result.text })
  } catch {
    return err('Erro interno', 500)
  }
}
