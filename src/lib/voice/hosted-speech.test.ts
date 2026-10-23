import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isHostedSpeechSupported,
  createHostedSpeechRecognition,
  HostedSpeechRecognition,
} from './hosted-speech'

afterEach(() => vi.unstubAllGlobals())

class MockBlob {
  size = 100
  type = 'audio/webm'

  constructor(_parts?: BlobPart[], _opts?: { type?: string }) {}

  arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0))
  text = vi.fn().mockResolvedValue('')
  slice = vi.fn().mockReturnValue(new MockBlob())
  stream = vi.fn()
  bytes = vi.fn().mockReturnValue(new Uint8Array())
}

class MockMediaRecorder extends EventTarget {
  state = 'inactive'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null

  static isTypeSupported = vi.fn().mockReturnValue(true)

  constructor(_stream?: unknown, _options?: unknown) {
    super()
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    if (this.ondataavailable) {
      const blob = new MockBlob([new ArrayBuffer(10)], { type: 'audio/webm' }) as unknown as Blob
      this.ondataavailable({ data: blob })
    }
    this.state = 'inactive'
    this.onstop?.()
  }
}

class MockTrack {
  stop = vi.fn()
  kind = 'audio'
}

class MockStream {
  getTracks = vi.fn().mockReturnValue([new MockTrack()])
}

function stubBrowserApis(opts: { getUserMediaReject?: string } = {}) {
  vi.stubGlobal('window', {})
  vi.stubGlobal('MediaRecorder', MockMediaRecorder as unknown as typeof MediaRecorder)
  vi.stubGlobal('FormData', class { append = vi.fn() })
  vi.stubGlobal('Blob', MockBlob as unknown as typeof Blob)
  vi.stubGlobal('navigator' as keyof typeof navigator, {
    mediaDevices: {
      getUserMedia: opts.getUserMediaReject
        ? vi.fn().mockRejectedValue(
            Object.assign(new Error('denied'), { name: opts.getUserMediaReject })
          )
        : vi.fn().mockResolvedValue(new MockStream() as unknown as MediaStream),
    },
  } as unknown as typeof navigator)
}

function stubFetchResponse(data: { text?: string; error?: { message?: string }; ok?: boolean; status?: number } = { text: 'hello world' }) {
  const mock = vi.fn().mockResolvedValue({
    ok: data.ok ?? !data.error,
    status: data.status ?? 200,
    json: async () => ({
      text: data.text,
      error: data.error,
    }),
  } as unknown as Response)
  vi.stubGlobal('fetch', mock as unknown as typeof fetch)
  return mock
}

describe('isHostedSpeechSupported', () => {
  it('returns false in a node-like environment', () => {
    expect(isHostedSpeechSupported()).toBe(false)
  })

  it('returns true when MediaRecorder, getUserMedia, FormData and fetch are present', () => {
    stubBrowserApis()
    vi.stubGlobal('fetch', vi.fn() as unknown as typeof fetch)
    expect(isHostedSpeechSupported()).toBe(true)
  })
})

describe('HostedSpeechRecognition', () => {
  it('fires onerror with not-allowed and onend when getUserMedia rejects', async () => {
    stubBrowserApis({ getUserMediaReject: 'NotAllowedError' })
    stubFetchResponse()

    const onError = vi.fn()
    const onEnd = vi.fn()

    const rec = new HostedSpeechRecognition()
    rec.onerror = onError
    rec.onend = onEnd
    rec.start()

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith({ error: 'not-allowed' }))
    expect(onEnd).toHaveBeenCalled()
  })

  it('records, transcribes, and fires onresult then onend', async () => {
    stubBrowserApis()
    stubFetchResponse({ text: 'hello world' })

    const onResult = vi.fn()
    const onError = vi.fn()
    const onEnd = vi.fn()

    const rec = new HostedSpeechRecognition({ maxRecordingMs: 50 })
    rec.onresult = onResult
    rec.onerror = onError
    rec.onend = onEnd
    rec.start()

    await vi.waitFor(() => expect(onResult).toHaveBeenCalled(), { timeout: 2000 })
    expect(onEnd).toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('stop() cancels before transcription and fires onend only', async () => {
    stubBrowserApis()
    const fetchMock = stubFetchResponse()

    const onResult = vi.fn()
    const onError = vi.fn()
    const onEnd = vi.fn()

    const rec = new HostedSpeechRecognition({ maxRecordingMs: 5000 })
    rec.onresult = onResult
    rec.onerror = onError
    rec.onend = onEnd
    rec.start()

    await vi.waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled()
    })
    rec.stop()

    await vi.waitFor(() => expect(onEnd).toHaveBeenCalled(), { timeout: 2000 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(onResult).not.toHaveBeenCalled()
  })

  it('fires onerror with provider message when transcription server returns an error', async () => {
    stubBrowserApis()
    stubFetchResponse({ ok: false, status: 400, error: { message: 'rate limited' } })

    const onError = vi.fn()
    const onEnd = vi.fn()
    const onResult = vi.fn()

    const rec = new HostedSpeechRecognition({ maxRecordingMs: 50 })
    rec.onresult = onResult
    rec.onerror = onError
    rec.onend = onEnd
    rec.start()

    await vi.waitFor(() => expect(onError).toHaveBeenCalled(), { timeout: 2000 })
    expect(onError.mock.calls[0][0]).toMatchObject({ error: 'rate limited' })
    expect(onEnd).toHaveBeenCalled()
    expect(onResult).not.toHaveBeenCalled()
  })
})

describe('createHostedSpeechRecognition', () => {
  it('delegates onresult/onerror/onend to callbacks', async () => {
    stubBrowserApis()
    stubFetchResponse({ text: 'hi there' })

    const onPartial = vi.fn()
    const onFinal = vi.fn()
    const onError = vi.fn()
    const onEnd = vi.fn()

    const rec = createHostedSpeechRecognition(
      { onPartial, onFinal, onError, onEnd },
      { maxRecordingMs: 50 }
    )
    rec.start()

    await vi.waitFor(() => expect(onFinal).toHaveBeenCalledWith('hi there'), { timeout: 2000 })
    expect(onPartial).not.toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})
