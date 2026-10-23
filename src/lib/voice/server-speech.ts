export type SpeechErrorCode =
  | 'rate_limit'
  | 'timeout'
  | 'upstream'
  | 'network'
  | 'empty'
  | 'permission'

export interface SpeechError extends Error {
  code: SpeechErrorCode
}

export function isSpeechError(e: unknown): e is SpeechError {
  return e instanceof Error && 'code' in e && typeof (e as SpeechError).code === 'string'
}

export function createSpeechError(code: SpeechErrorCode, message: string): SpeechError {
  const err = new Error(message) as SpeechError
  err.code = code
  return err
}

export function isMediaRecorderSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

export function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return null
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return null
}

export interface RecordingHandle {
  stop(): Promise<Blob>
  cancel(): void
}

export interface StartRecordingOptions {
  maxDurationMs?: number
  mimeType?: string
}

export async function startRecording(
  opts: StartRecordingOptions = {}
): Promise<RecordingHandle> {
  const maxDurationMs = opts.maxDurationMs ?? 60000
  const mimeType = opts.mimeType

  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw createSpeechError('network', 'Recording is not supported in this environment.')
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      throw createSpeechError('permission', 'Microphone access was denied. Check browser permissions.')
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      throw createSpeechError('permission', 'No microphone was detected.')
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      throw createSpeechError('network', 'The microphone is busy or unavailable.')
    }
    throw createSpeechError('network', 'Could not access the microphone.')
  }

  let recorder: MediaRecorder
  try {
    recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream)
  } catch {
    stream.getTracks().forEach((t) => t.stop())
    throw createSpeechError('network', 'Failed to initialize recorder.')
  }

  const chunks: BlobPart[] = []
  let stopped = false
  let resolveStop: (blob: Blob) => void
  let rejectStop: (err: Error) => void

  const stopPromise = new Promise<Blob>((resolve, reject) => {
    resolveStop = resolve
    rejectStop = reject
  })

  recorder.ondataavailable = (e: BlobEvent) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data)
    }
  }

  recorder.onerror = () => {
    if (!stopped) {
      stopped = true
      stream.getTracks().forEach((t) => t.stop())
      rejectStop(createSpeechError('upstream', 'Recording failed.'))
    }
  }

  recorder.onstop = () => {
    if (stopped) return
    stopped = true
    stream.getTracks().forEach((t) => t.stop())
    const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
    resolveStop(blob)
  }

  recorder.start()

  let durationTimer: ReturnType<typeof setTimeout> | null = null
  if (maxDurationMs > 0) {
    durationTimer = setTimeout(() => {
      if (recorder.state === 'recording') {
        try {
          recorder.stop()
        } catch {
          /* ignore */
        }
      }
    }, maxDurationMs)
  }

  return {
    async stop(): Promise<Blob> {
      if (durationTimer) clearTimeout(durationTimer)
      if (recorder.state !== 'inactive') {
        recorder.stop()
      }
      return stopPromise
    },
    cancel(): void {
      if (durationTimer) clearTimeout(durationTimer)
      if (!stopped) {
        stopped = true
        if (recorder.state !== 'inactive') {
          try {
            recorder.stop()
          } catch {
            /* ignore */
          }
        }
        stream.getTracks().forEach((t) => t.stop())
        rejectStop(createSpeechError('network', 'Recording cancelled.'))
      }
    },
  }
}

let currentAudio: HTMLAudioElement | null = null
let currentAbortController: AbortController | null = null

export function isServerSpeechPlaying(): boolean {
  return currentAudio !== null && !currentAudio.paused && !currentAudio.ended
}

export function stopServerSpeech(): void {
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
  }
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio.removeAttribute('src')
    URL.revokeObjectURL(currentAudio.src)
    currentAudio = null
  }
}

export interface SpeakServerOptions {
  onEnd?: () => void
  onError?: (err: SpeechError) => void
}

export async function speakServer(
  sessionId: string,
  text: string,
  opts: SpeakServerOptions = {}
): Promise<void> {
  stopServerSpeech()

  currentAbortController = new AbortController()

  try {
    const res = await fetch(`/api/sessions/${sessionId}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: currentAbortController.signal,
    })

    if (!res.ok) {
      let message = 'Speech synthesis failed.'
      let code: SpeechErrorCode = 'upstream'
      try {
        const data = await res.json() as { error?: string }
        if (data.error) message = data.error
      } catch {
        /* ignore */
      }
      if (res.status === 429) code = 'rate_limit'
      else if (res.status === 504) code = 'timeout'
      throw createSpeechError(code, message)
    }

    const arrayBuffer = await res.arrayBuffer()
    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
    const objectUrl = URL.createObjectURL(blob)

    currentAudio = new Audio(objectUrl)

    return new Promise<void>((resolve, reject) => {
      if (!currentAudio) {
        if (opts.onError) {
          opts.onError(createSpeechError('network', 'Audio element not initialized.'))
          resolve()
        } else {
          reject(createSpeechError('network', 'Audio element not initialized.'))
        }
        return
      }

      currentAudio.onended = () => {
        URL.revokeObjectURL(objectUrl)
        currentAudio = null
        currentAbortController = null
        opts.onEnd?.()
        resolve()
      }

      currentAudio.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        const err = createSpeechError('upstream', 'Audio playback failed.')
        currentAudio = null
        currentAbortController = null
        opts.onError?.(err)
        if (opts.onError) {
          resolve()
        } else {
          reject(err)
        }
      }

      currentAudio.play().catch((e) => {
        URL.revokeObjectURL(objectUrl)
        const err = createSpeechError('network', e instanceof Error ? e.message : 'Playback failed.')
        currentAudio = null
        currentAbortController = null
        opts.onError?.(err)
        if (opts.onError) {
          resolve()
        } else {
          reject(err)
        }
      })
    })
  } catch (e) {
    currentAbortController = null
    let err: SpeechError
    if (e instanceof Error && e.name === 'AbortError') {
      err = createSpeechError('timeout', 'Speech synthesis timed out.')
    } else if (isSpeechError(e)) {
      err = e
    } else {
      err = createSpeechError('network', e instanceof Error ? e.message : 'Network error.')
    }
    if (opts.onError) {
      opts.onError(err)
      return
    }
    throw err
  }
}