import { ok } from '@/lib/api'

export async function GET() {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  const configured = hasAnthropic && hasOpenAI

  return ok({ configured, hasAnthropic, hasOpenAI })
}
