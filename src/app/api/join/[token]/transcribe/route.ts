import { NextRequest, NextResponse } from 'next/server'
import { isResponse, resolveInvite } from '@/lib/sessions/join-context'
import { transcribeAudio } from '@/lib/voice/stt-service'
import { SttError } from '@/lib/voice/errors'

export const runtime = 'nodejs'
export const maxDuration = 25

const STATUS_CODE: Record<SttError['code'], number> = {
  not_configured: 503,
  timeout: 504,
  provider_error: 502,
  payload_too_large: 413,
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const ctx = await resolveInvite(params.token)
  if (isResponse(ctx)) return ctx

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Could not read the audio data.' }, { status: 400 })
  }

  const file = formData.get('audio')
  if (!file || !(file instanceof File) || !file.name || file.size === 0) {
    return NextResponse.json({ error: 'No audio was received.' }, { status: 400 })
  }

  try {
    const text = await transcribeAudio(file)
    return NextResponse.json({ text })
  } catch (e) {
    if (e instanceof SttError) {
      return NextResponse.json({ error: e.message }, { status: STATUS_CODE[e.code] ?? 502 })
    }
    const message = e instanceof Error ? e.message : 'Speech service is unavailable.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
