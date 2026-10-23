import type {
  SpeechRecognitionType,
  SpeechRecognitionEventType,
  SpeechRecognitionErrorType,
  BrowserSpeechCallbacks,
} from './browser-speech'

export interface HostedSpeechOptions {
  maxRecordingMs?: number
  endpoint?: string
}

const DEFAULT_RECORDING_MS = 8000

export function isHostedSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof FormData !== 'undefined' &&
    typeof fetch === 'function'
  )
}

function getBestMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ]
  for (const type of candidates) {
    if (
      typeof MediaRecorder !== 'undefined' &&
      typeof MediaRecorder.isTypeSupported === 'function' &&
      MediaRecorder.isTypeSupported(type)
    ) {
      return type
    }
  }
  return ''
}

export class HostedSpeechRecognition
  extends EventTarget
  implements SpeechRecognitionType
{
  continuous = false
  interimResults = false
  lang = 'en-US'
  onresult: ((event: SpeechRecognitionEventType) => void) | null = null
  onerror: ((event: SpeechRecognitionErrorType) => void) | null = null
  onend: (() => void) | null = null

  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: BlobPart[] = []
  private active = false
  private ended = false
  private recordingMs: number
  private endpoint: string
  private timeoutId: ReturnType<typeof setTimeout> | null = null
  private abortController: AbortController | null = null

  constructor(opts: HostedSpeechOptions = {}) {
    super()
    this.recordingMs = opts.maxRecordingMs ?? DEFAULT_RECORDING_MS
    this.endpoint = opts.endpoint ?? '/api/voice/transcribe'
  }

  start(): void {
    if (this.active) return
    this.active = true
    this.ended = false
    this.chunks = []
    this._begin()
  }

  stop(): void {
    this.active = false
    this._cleanup()
  }

  abort(): void {
    this.stop()
  }

  private _cleanup() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop()
      } catch {
        /* ignore */
      }
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
    }
  }

  private _fireEnd() {
    if (this.ended) return
    this.ended = true
    this.onend?.()
  }

  private _fireError(error: string) {
    if (this.ended) return
    this.onerror?.({ error } as SpeechRecognitionErrorType)
  }

  private _fireResult(text: string) {
    if (this.ended) return
    const event: SpeechRecognitionEventType = {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: text }], { isFinal: true, length: 1 }),
      ],
    }
    this.onresult?.(event)
  }

  private async _begin() {
    if (!this.active) return

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      if (!this.active) {
        this._fireEnd()
        return
      }
      const name = e instanceof Error ? e.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        this._fireError('not-allowed')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        this._fireError('audio-capture')
      } else {
        this._fireError('network')
      }
      this.active = false
      this._fireEnd()
      return
    }

    if (!this.active) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
      this._fireEnd()
      return
    }

    const mimeType = getBestMimeType()

    try {
      this.recorder = mimeType
        ? new MediaRecorder(this.stream, { mimeType })
        : new MediaRecorder(this.stream)
    } catch {
      this._fireError('audio-capture')
      this.active = false
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
      this._fireEnd()
      return
    }

    this.recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data)
      }
    }

    this.recorder.onerror = () => {
      this._fireError('audio-capture')
      this.active = false
      this._fireEnd()
    }

    this.recorder.onstop = () => {
      if (!this.active) {
        this._fireEnd()
        return
      }
      const blob = new Blob(this.chunks, { type: mimeType || 'audio/webm' })
      this.chunks = []
      if (blob.size === 0) {
        this._fireError('no-speech')
        this.active = false
        this._fireEnd()
        return
      }
      this._transcribe(blob)
    }

    this.recorder.start()
    this.timeoutId = setTimeout(() => {
      if (this.recorder && this.recorder.state === 'recording') {
        try {
          this.recorder.stop()
        } catch {
          /* ignore */
        }
      }
    }, this.recordingMs)
  }

  private async _transcribe(blob: Blob) {
    if (!this.active) {
      this._fireEnd()
      return
    }

    this.abortController = new AbortController()
    const formData = new FormData()
    formData.append('audio', blob, 'recording.webm')

    let res: Response
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        body: formData,
        signal: this.abortController.signal,
      })
    } catch {
      if (!this.active) {
        this._fireEnd()
        return
      }
      this._fireError('network')
      this.active = false
      this._fireEnd()
      return
    } finally {
      this.abortController = null
    }

    if (!this.active) {
      this._fireEnd()
      return
    }

    if (!res.ok) {
      let message = 'transcription_failed'
      try {
        const data = await res.json() as { error?: string }
        if (typeof data.error === 'string' && data.error.length > 0) {
          message = data.error
        }
      } catch {
        /* ignore JSON parse failure */
      }
      this._fireError(message)
      this.active = false
      this._fireEnd()
      return
    }

    const data = await res.json() as { text?: string }
    const text = (data.text ?? '').trim()
    if (text) {
      this._fireResult(text)
    }
    this.active = false
    this._fireEnd()
  }
}

export function createHostedSpeechRecognition(
  callbacks: BrowserSpeechCallbacks,
  opts: HostedSpeechOptions = {}
): HostedSpeechRecognition {
  const recognition = new HostedSpeechRecognition(opts)
  recognition.onresult = (event: SpeechRecognitionEventType) => {
    let interim = ''
    let final = ''

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      const transcript = result[0]?.transcript ?? ''

      if (result.isFinal) {
        final += transcript
      } else {
        interim += transcript
      }
    }

    if (interim) callbacks.onPartial(interim)
    if (final) callbacks.onFinal(final)
  }
  recognition.onerror = (event: SpeechRecognitionErrorType) => {
    callbacks.onError(event.error)
  }
  recognition.onend = () => {
    callbacks.onEnd()
  }
  return recognition
}
