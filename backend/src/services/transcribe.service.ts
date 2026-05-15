import OpenAI, { toFile } from 'openai'

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada')
  }
  return new OpenAI({ apiKey })
}

export async function transcribe(
  buffer: Buffer,
  originalname: string,
  mimetype: string,
): Promise<string> {
  const openai = getOpenAIClient()

  const file = await toFile(buffer, originalname, { type: mimetype })

  const result = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'pt',
  })

  return result.text
}
