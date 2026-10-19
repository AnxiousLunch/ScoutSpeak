import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getModelClient } from '@/lib/ai'
import { AiError } from '@/lib/ai/errors'

export const runtime = 'nodejs'

const PingSchema = z.object({
  reply: z.string(),
  model_ok: z.boolean(),
})

export async function POST(req: NextRequest) {
  if (process.env.AI_PING_ENABLED !== 'true') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  let userPrompt = 'Ping. Return the JSON object only.'
  try {
    const body = (await req.json()) as { prompt?: string }
    if (typeof body.prompt === 'string' && body.prompt.length > 0) {
      userPrompt = body.prompt
    }
  } catch {
    // ignore malformed body and use default
  }

  try {
    const client = getModelClient()
    const result = await client.generateJSON({
      system:
        'You are a ping test. Return ONLY JSON with fields { "reply": "pong", "model_ok": true }.',
      user: userPrompt,
      schema: PingSchema,
      maxTokens: 100,
    })

    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof AiError) {
      const status =
        e.code === 'rate_limit'
          ? 429
          : e.code === 'timeout'
            ? 504
            : e.code === 'config'
              ? 500
              : 502

      return NextResponse.json(
        { error: e.code, message: e.message },
        { status }
      )
    }

    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json(
      { error: 'internal_error', message },
      { status: 500 }
    )
  }
}
