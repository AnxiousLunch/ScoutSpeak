import { SttError } from './errors'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const TRANSCRIPTION_TIMEOUT_MS = 15000

export async function transcribeAudio(file: File): Promise<string> {
  if (file.size > MAX_AUDIO_BYTES) {
    throw new SttError('payload_too_large', 'Audio is too long.')
  }

  const baseUrl = process.env.VOICE_PROVIDER_URL || process.env.AI_BASE_URL
  const apiKey = process.env.VOICE_PROVIDER_API_KEY || process.env.AI_API_KEY
  const model = process.env.VOICE_STT_MODEL || 'whisper-large-v3-turbo'

  if (!baseUrl || !apiKey) {
    throw new SttError(
      'not_configured',
      'Speech-to-text is not configured on the server. Type your reply instead.'
    )
  }

  const sttUrl = `${baseUrl.replace(/\/$/, '')}/audio/transcriptions`
  const formData = new FormData()
  formData.append('file', file, file.name || 'recording.webm')
  formData.append('model', model)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS)

  try {
    const res = await fetch(sttUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
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
      throw new SttError('provider_error', message)
    }

    const data = await res.json() as { text?: string }
    return (data.text ?? '').trim()
  } catch (e) {
    if (e instanceof SttError) throw e
    if (e instanceof Error && e.name === 'AbortError') {
      throw new SttError(
        'timeout',
        'Speech service timed out. Try again or type your reply.'
      )
    }
    throw new SttError(
      'provider_error',
      e instanceof Error ? e.message : 'Speech service is unavailable.'
    )
  } finally {
    clearTimeout(timeout)
  }
}
