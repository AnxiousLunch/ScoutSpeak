import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { getModelClient } from '@/lib/ai'
import { AiError } from '@/lib/ai/errors'

export const runtime = 'nodejs'

const TurnSchema = z.object({
  history: z
    .array(
      z.object({
        speaker: z.enum(['agent', 'human']),
        text: z.string().max(2000),
      })
    )
    .max(6),
  text: z.string().min(1).max(500),
})

function statusFromAiError(error: AiError): number {
  switch (error.code) {
    case 'rate_limit':
      return 429
    case 'timeout':
      return 504
    case 'config':
      return 500
    case 'invalid_output':
    case 'provider_error':
    default:
      return 502
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel !== 'aal2') {
    return NextResponse.json({ error: 'mfa_challenge_required' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = TurnSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', message: parsed.error.message },
      { status: 400 }
    )
  }

  const { history, text } = parsed.data

  const conversation = history
    .map((turn) => `${turn.speaker === 'agent' ? 'AI' : 'Human'}: ${turn.text}`)
    .join('\n')

  const systemPrompt =
    "You are an AI sales representative. Begin by stating that you are an AI when it is your first message. Keep replies to 1-2 short sentences. Do not invent facts about the prospect or your services. Only make claims grounded in information the human has already provided."

  const userPrompt = `Continue the sales conversation.\n\n${conversation}\n\nHuman: ${text}\n\nAI:`

  try {
    const client = getModelClient()
    const reply = await client.generateText({
      system: systemPrompt,
      user: userPrompt,
      maxTokens: 120,
    })

    return NextResponse.json({ reply: reply.trim() })
  } catch (e) {
    if (e instanceof AiError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: statusFromAiError(e) }
      )
    }

    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: 'internal_error', message }, { status: 500 })
  }
}
