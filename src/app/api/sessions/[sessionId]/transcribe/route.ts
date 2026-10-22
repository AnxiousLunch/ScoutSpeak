import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_AUDIO_BYTES = 15 * 1024 * 1024
const MIN_AUDIO_BYTES = 1000
const TRANSCRIPTION_TIMEOUT_MS = 30000

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

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Could not read the audio data.' }, { status: 400 })
  }

  const file = formData.get('audio')
  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No audio was received.' }, { status: 400 })
  }

  if (file.size < MIN_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Audio too short or empty.' }, { status: 400 })
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Audio file too large.' }, { status: 413 })
  }

  const baseUrl = process.env.VOICE_PROVIDER_URL || process.env.AI_BASE_URL
  const apiKey = process.env.VOICE_PROVIDER_API_KEY || process.env.AI_API_KEY
  const model = process.env.VOICE_STT_MODEL || 'whisper-large-v3-turbo'

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: 'Speech-to-text is not configured on the server.' },
      { status: 503 }
    )
  }

  const sttUrl = `${baseUrl.replace(/\/$/, '')}/audio/transcriptions`
  const upstreamFormData = new FormData()
  upstreamFormData.append('file', file, file.name || 'recording.webm')
  upstreamFormData.append('model', model)
  upstreamFormData.append('response_format', 'json')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS)

  try {
    const res = await fetch(sttUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamFormData,
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
      console.error('[transcribe] Groq error:', res.status, message.slice(0, 200))
      return NextResponse.json({ error: 'Transcription failed.' }, { status: 502 })
    }

    const data = await res.json() as { text?: string }
    const text = (data.text ?? '').trim()

    if (!text) {
      return NextResponse.json({ error: 'No speech detected.' }, { status: 422 })
    }

    return NextResponse.json({ text })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return NextResponse.json({ error: 'Transcription timed out.' }, { status: 504 })
    }
    const message = e instanceof Error ? e.message : 'Speech service is unavailable.'
    console.error('[transcribe] error:', message)
    return NextResponse.json({ error: 'Transcription failed.' }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}