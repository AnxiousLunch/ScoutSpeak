import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createBrowserSpeechRecognition,
  isBrowserSpeechSupported,
  isSpeechSynthesisSupported,
  browserSpeechErrorMessage,
  speak,
  stopSpeaking,
  type SpeechRecognitionType,
} from './browser-speech'

class FakeRecognition extends EventTarget implements SpeechRecognitionType {
  continuous = false
  interimResults = false
  lang = ''
  onresult: SpeechRecognitionType['onresult'] = null
  onerror: SpeechRecognitionType['onerror'] = null
  onend: SpeechRecognitionType['onend'] = null
  start = vi.fn()
  stop = vi.fn()
  abort = vi.fn()
}

class FakeUtterance {
  lang = ''
  onend: (() => void) | null = null
  constructor(readonly text: string) {}
}

afterEach(() => vi.unstubAllGlobals())

describe('browser speech', () => {
  it('transcribes final speech and reports interim/error/end events', () => {
    vi.stubGlobal('window', { SpeechRecognition: FakeRecognition })
    const onPartial = vi.fn()
    const onFinal = vi.fn()
    const onError = vi.fn()
    const onEnd = vi.fn()
    const recognition = createBrowserSpeechRecognition({ onPartial, onFinal, onError, onEnd })

    recognition.onresult?.({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'hello' }], { isFinal: false }),
        Object.assign([{ transcript: 'world' }], { isFinal: true }),
      ],
    })
    recognition.onerror?.({ error: 'no-speech' })
    recognition.onend?.()

    expect(isBrowserSpeechSupported()).toBe(true)
    expect(recognition.lang).toBe('en-US')
    expect(onPartial).toHaveBeenCalledWith('hello')
    expect(onFinal).toHaveBeenCalledWith('world')
    expect(onError).toHaveBeenCalledWith('no-speech')
    expect(onEnd).toHaveBeenCalledOnce()
  })

  it('speaks model text aloud and can cancel it', () => {
    const speakMock = vi.fn()
    const cancelMock = vi.fn()
    vi.stubGlobal('window', { speechSynthesis: { speak: speakMock, cancel: cancelMock } })
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)

    expect(speak('Hello from the AI.')).toBe(true)
    stopSpeaking()

    expect(speakMock).toHaveBeenCalledOnce()
    expect(speakMock.mock.calls[0][0]).toMatchObject({ text: 'Hello from the AI.', lang: 'en-US' })
    expect(cancelMock).toHaveBeenCalledTimes(2)
  })
})

describe('speech synthesis support', () => {
  it('isSpeechSynthesisSupported returns true when speechSynthesis and SpeechSynthesisUtterance exist', () => {
    vi.stubGlobal('window', { speechSynthesis: { speak: vi.fn(), cancel: vi.fn() } })
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
    expect(isSpeechSynthesisSupported()).toBe(true)
  })

  it('isSpeechSynthesisSupported returns false when speechSynthesis is missing', () => {
    vi.stubGlobal('window', {})
    expect(isSpeechSynthesisSupported()).toBe(false)
  })
})

describe('browserSpeechErrorMessage', () => {
  it('returns specific messages for known error codes', () => {
    expect(browserSpeechErrorMessage('not-allowed')).toBe('Microphone access was denied. Check browser permissions and try again.')
    expect(browserSpeechErrorMessage('service-not-allowed')).toBe('Microphone access was denied. Check browser permissions and try again.')
    expect(browserSpeechErrorMessage('no-speech')).toBe('No speech was detected. Try speaking closer to the mic.')
    expect(browserSpeechErrorMessage('audio-capture')).toBe('No microphone found. Typed input is always available.')
    expect(browserSpeechErrorMessage('network')).toContain('speech recognition service')
  })

  it('wraps unknown errors', () => {
    expect(browserSpeechErrorMessage('bad-grammar')).toBe('Speech recognition error: bad-grammar. Try again.')
  })
})
