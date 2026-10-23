export interface SpeechRecognitionEventType {
  resultIndex: number
  results: {
    isFinal: boolean
    [index: number]: { transcript: string }
    length: number
  }[]
}

export interface SpeechRecognitionErrorType {
  error: string
}

export interface SpeechRecognitionType extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventType) => void) | null
  onerror: ((event: SpeechRecognitionErrorType) => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognitionType }
    webkitSpeechRecognition?: { new (): SpeechRecognitionType }
  }
}

export interface BrowserSpeechCallbacks {
  onPartial: (text: string) => void
  onFinal: (text: string) => void
  onError: (error: string) => void
  onEnd: () => void
}

export function isBrowserSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  )
}

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.speechSynthesis &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  )
}

export function browserSpeechErrorMessage(error: string): string {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'Microphone access was denied. Check browser permissions and try again.'
  }
  if (error === 'no-speech') {
    return 'No speech was detected. Try speaking closer to the mic.'
  }
  if (error === 'audio-capture') {
    return 'No microphone found. Typed input is always available.'
  }
  if (error === 'network') {
    return 'This browser could not connect to its speech recognition service. Try speaking via hosted recognition or type your reply.'
  }
  return `Speech recognition error: ${error}. Try again.`
}

export async function requestMicrophoneAccess(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone access requires a secure HTTPS page and a browser that supports audio input.')
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      throw new Error('Microphone permission was denied. Allow microphone access in your browser settings, then retry.')
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      throw new Error('No microphone was detected. Connect or enable a microphone, or use typed input.')
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      throw new Error('The microphone is busy or unavailable to this browser. Close other apps using it and retry.')
    }
    throw new Error('Could not access the microphone. Check browser permissions and device settings, or use typed input.')
  }
}

export function createBrowserSpeechRecognition(
  callbacks: BrowserSpeechCallbacks
): SpeechRecognitionType {
  const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Constructor) {
    throw new Error('Speech recognition is not supported in this browser.')
  }

  const recognition = new Constructor()
  recognition.continuous = false
  recognition.interimResults = true
  recognition.lang = 'en-US'

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

export function speak(text: string, opts?: { onEnd?: () => void }): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return false
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  if (opts?.onEnd) {
    utterance.onend = opts.onEnd
  }
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
  return true
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}
