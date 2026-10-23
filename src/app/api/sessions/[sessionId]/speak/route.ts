import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 25

const MAX_TEXT_CHARS = 2000
const TTS_TIMEOUT_MS = 20000

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const supabase = createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 })
  }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel !== 'aal2') {
    return NextResponse.json({ error: 'Complete your two-factor check first.' }, { status: 403 })
  }

  const { data: session, error: sessionError } = await supabase
    .from('conversation_sessions')
    .select('id')
    .eq('id', params.sessionId)
    .eq('owner_id', user.id)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'This session was not found.' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { text } = body as { text?: string }
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'Text is required.' }, { status: 400 })
  }

  if (text.length > MAX_TEXT_CHARS) {
    return NextResponse.json({ error: 'Text too long for synthesis.' }, { status: 400 })
  }

  const baseUrl = process.env.VOICE_PROVIDER_URL || process.env.AI_BASE_URL
  const apiKey = process.env.VOICE_PROVIDER_API_KEY || process.env.AI_API_KEY

  let model = process.env.VOICE_TTS_MODEL
  let voice = process.env.VOICE_TTS_VOICE

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: 'Text-to-speech is not configured on the server.' },
      { status: 503 }
    )
  }

  if (!model) {
    model = 'playai-tts'
    voice = 'Fritz-PlayAI'
  }

  const ttsUrl = `${baseUrl.replace(/\/$/, '')}/audio/speech`
  const payload: Record<string, string> = {
    model,
    input: text.trim(),
    response_format: 'mp3',
  }
  if (voice) {
    payload.voice = voice
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS)

  try {
    const res = await fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!res.ok) {
      let message = `Speech service error: HTTP ${res.status}`
      try {
        const err = await res.json() as { error?: { message?: string } }
        message = err.error?.message || message
      } catch {
        /* ignore JSON parse failure */
      }
      console.error('[speak] Groq error:', res.status, message.slice(0, 200))
      return NextResponse.json({ error: 'Speech synthesis failed.' }, { status: 502 })
    }

    const arrayBuffer = await res.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return NextResponse.json({ error: 'Speech synthesis timed out.' }, { status: 504 })
    }
    const message = e instanceof Error ? e.message : 'Speech service is unavailable.'
    console.error('[speak] error:', message)
    return NextResponse.json({ error: 'Speech synthesis failed.' }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}