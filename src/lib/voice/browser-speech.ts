interface SpeechRecognitionEventType {
  resultIndex: number
  results: {
    isFinal: boolean
    [index: number]: { transcript: string }
    length: number
  }[]
}

interface SpeechRecognitionErrorType {
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

export function speak(text: string, opts?: { onEnd?: () => void }): void {
  if (typeof window === 'undefined') return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  if (opts?.onEnd) {
    utterance.onend = opts.onEnd
  }
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined') {
    window.speechSynthesis.cancel()
  }
}
