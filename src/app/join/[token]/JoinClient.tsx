'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createBrowserSpeechRecognition,
  isBrowserSpeechSupported,
  isSpeechSynthesisSupported,
  requestMicrophoneAccess,
  browserSpeechErrorMessage,
  speak,
  stopSpeaking,
  type SpeechRecognitionType,
  type BrowserSpeechCallbacks,
} from '@/lib/voice/browser-speech'
import { isHostedSpeechSupported, createHostedSpeechRecognition } from '@/lib/voice/hosted-speech'

interface Msg { sequence_number: number; speaker_role: string; message_text: string | null }
interface Payload { status: string; messages: Msg[]; businessName: string | null }

const ENDED = ['completed', 'cancelled', 'failed']

export function JoinClient({ token }: { token: string }) {
  const base = `/api/join/${encodeURIComponent(token)}`
  const [data, setData] = useState<Payload | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [muted, setMuted] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [speechMode, setSpeechMode] = useState<'browser' | 'hosted' | 'unsupported'>('browser')
  const recRef = useRef<SpeechRecognitionType | null>(null)
  const mutedRef = useRef(muted)
  const micOnRef = useRef(micOn)
  const busyRef = useRef(busy)
  const statusRef = useRef('')
  const mountedRef = useRef(true)
  const sendRef = useRef<(t: string, m: 'voice_browser' | 'voice_hosted' | 'typed') => void>(() => {})
  const speechModeRef = useRef(speechMode)

  mutedRef.current = muted
  micOnRef.current = micOn
  busyRef.current = busy
  statusRef.current = data?.status ?? ''
  speechModeRef.current = speechMode

  const call = useCallback(async (path: string, init?: RequestInit): Promise<Payload> => {
    const res = await fetch(`${base}/${path}`, init)
    const body = (await res.json().catch(() => ({}))) as Partial<Payload> & { message?: string }
    if (!res.ok) {
      const err = new Error(body.message || 'The request failed. Please retry.') as Error & { status?: number }
      err.status = res.status
      throw err
    }
    return body as Payload
  }, [base])

  const stopRec = useCallback(() => {
    try { recRef.current?.stop() } catch { /* ignore */ }
    recRef.current = null
  }, [])

  function makeSpeechCallbacks(): BrowserSpeechCallbacks {
    return {
      onPartial: (p) => setText(`${p}…`),
      onFinal: (f) => {
        setText('')
        sendRef.current(f.trim(), speechModeRef.current === 'hosted' ? 'voice_hosted' : 'voice_browser')
      },
      onError: (err) => {
        if (
          (err === 'network' || err === 'service-not-allowed') &&
          speechModeRef.current === 'browser' &&
          isHostedSpeechSupported()
        ) {
          setSpeechMode('hosted')
          speechModeRef.current = 'hosted'
          startHostedMic()
          return
        }
        setMicError(browserSpeechErrorMessage(err))
        setMicOn(false)
        if (speechModeRef.current === 'hosted') {
          setSpeechMode('unsupported')
        }
      },
      onEnd: () => {},
    }
  }

  function startHostedMic() {
    if (!isHostedSpeechSupported()) {
      setMicError('Speech recognition is not available in this browser. Typed input is always available.')
      setSpeechMode('unsupported')
      setMicOn(false)
      return
    }
    setMicError(null)
    setSpeechMode('hosted')
    speechModeRef.current = 'hosted'
    const rec = createHostedSpeechRecognition(makeSpeechCallbacks(), {
      maxRecordingMs: 8000,
      endpoint: `${base}/transcribe`,
    })
    recRef.current = rec
    rec.start()
    setMicOn(true)
  }

  const startMic = useCallback(async () => {
    if (speechModeRef.current === 'unsupported') {
      setMicError('Speech recognition is not available. Typed input is always available.')
      return
    }
    if (speechModeRef.current === 'hosted' || !isBrowserSpeechSupported()) {
      startHostedMic()
      return
    }
    setMicError(null)
    try {
      await requestMicrophoneAccess()
      const rec = createBrowserSpeechRecognition(makeSpeechCallbacks())
      recRef.current = rec
      rec.start()
      setMicOn(true)
    } catch (cause) {
      if (isHostedSpeechSupported()) {
        setSpeechMode('hosted')
        speechModeRef.current = 'hosted'
        startHostedMic()
      } else {
        setMicError(cause instanceof Error ? cause.message : 'Could not start the microphone.')
        setMicOn(false)
        setSpeechMode('unsupported')
      }
    }
  }, [base])

  const say = useCallback((t: string | null | undefined) => {
    if (!t || mutedRef.current) return
    stopRec()
    const spoke = speak(t, {
      onEnd: () => {
        if (mountedRef.current && micOnRef.current && !ENDED.includes(statusRef.current)) startMic()
      },
    })
    if (!spoke && micOnRef.current && !ENDED.includes(statusRef.current)) {
      startMic()
    }
  }, [startMic, stopRec])

  const playMessage = useCallback((t: string) => {
    setMuted(false)
    stopRec()
    if (!isSpeechSynthesisSupported()) {
      if (micOnRef.current && !ENDED.includes(statusRef.current)) {
        startMic()
      }
      return
    }
    if (!speak(t)) {
      setError('Speech playback is not available in this browser. You can still read the transcript.')
    }
  }, [stopRec, startMic])

  const lastAgent = (p: Payload) => [...p.messages].reverse().find((m) => m.speaker_role === 'agent')

  useEffect(() => {
    mountedRef.current = true
    call('state')
      .then(setData)
      .catch((e: Error & { status?: number }) => {
        if (e.status === 410) setExpired(true)
        else setFatal(e.message)
      })
    return () => {
      mountedRef.current = false
      stopSpeaking()
      stopRec()
    }
  }, [call, stopRec])

  const status = data?.status ?? ''
  const ended = ENDED.includes(status)
  useEffect(() => {
    if (ended) { stopSpeaking(); stopRec(); setMicOn(false) }
  }, [ended, stopRec])

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.') } finally { setBusy(false) }
  }

  async function onConsent(checked: boolean) {
    setConsent(checked)
    if (!checked) return
    await run(async () => {
      try { setData(await call('consent', { method: 'POST' })) } catch (e) { setConsent(false); throw e }
    })
  }

  const start = () => run(async () => {
    const inputMethod = micOn ? (speechModeRef.current === 'hosted' ? 'voice_hosted' : 'voice_browser') : 'typed'
    const p = await call('start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputMethod }),
    })
    setData(p)
    say(lastAgent(p)?.message_text)
  })

  const send = useCallback((submitted: string, inputMethod: 'voice_browser' | 'voice_hosted' | 'typed') => {
    if (!submitted || busyRef.current) return
    stopRec()
    setText('')
    setBusy(true); setError(null)
    call('turn', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: submitted, inputMethod }),
    })
      .then((p) => { setData(p); say(lastAgent(p)?.message_text) })
      .catch((e: Error) => { setText(submitted); setError(`${e.message} Your message is kept so you can retry.`) })
      .finally(() => setBusy(false))
  }, [call, say, stopRec])
  sendRef.current = send

  const leave = () => run(async () => {
    stopSpeaking(); stopRec(); setMicOn(false)
    setData(await call('end', { method: 'POST' }))
  })

  const reportAudioLost = () => run(async () => {
    stopSpeaking(); stopRec(); setMicOn(false)
    setData(await call('report', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'audio_lost' }),
    }))
  })

  if (expired) {
    return (
      <div className="mx-auto max-w-md py-12 text-center space-y-4">
        <h1 className="text-2xl font-bold">Link expired</h1>
        <p className="text-sm text-muted-foreground">This conversation link has expired. The host can create a new link if the conversation is still needed.</p>
      </div>
    )
  }

  if (fatal) {
    return <Alert variant="destructive"><AlertTitle>Link unavailable</AlertTitle><AlertDescription>{fatal}</AlertDescription></Alert>
  }
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>

  const who = data.businessName || 'the business'
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversation with {who}</CardTitle>
        <CardDescription>
          You are speaking with an AI representative. The transcript will be saved. No audio is stored. You may leave at any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2" aria-live="polite" aria-label="Conversation transcript">
          {data.messages.length === 0 && <p className="text-sm text-muted-foreground">The transcript will appear here.</p>}
          {data.messages.map((m) => (
            <div key={m.sequence_number} className="rounded-md border p-3 text-sm">
              <b className="block text-xs">{m.speaker_role === 'agent' ? 'AI REPRESENTATIVE' : 'YOU'}</b>
              <p>{m.message_text}</p>
              {m.speaker_role === 'agent' && m.message_text && <Button type="button" size="sm" variant="outline" onClick={() => playMessage(m.message_text!)}>▶ Play aloud</Button>}
            </div>
          ))}
          {busy && status === 'active' && <p className="text-sm text-muted-foreground">The AI is replying…</p>}
        </div>

        {error && <Alert variant="destructive"><AlertTitle>Couldn’t complete that step</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        {status === 'waiting_for_participant' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <input id="consent" type="checkbox" className="mt-0.5 h-4 w-4" checked={consent} disabled={busy} onChange={(e) => void onConsent(e.target.checked)} />
              <Label htmlFor="consent" className="text-sm font-normal">
                I understand I am speaking with an AI representative and agree that the transcript is saved.
              </Label>
            </div>
            <Button onClick={() => void start()} disabled={busy || !consent}>{busy ? 'Please wait…' : 'Start conversation'}</Button>
          </div>
        )}

        {status === 'created' && <p className="text-sm text-muted-foreground">The host has not opened this conversation yet. Please check back soon.</p>}

        {status === 'active' && (
          <>
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); send(text.trim(), 'typed') }}>
              <Input className="min-w-0 flex-1" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} disabled={busy} placeholder="Type your reply…" aria-label="Your reply" />
              <Button type="submit" disabled={busy || !text.trim()}>Send</Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => { if (micOn) { stopRec(); setMicOn(false) } else startMic() }} aria-label={micOn ? 'Turn microphone off' : 'Turn microphone on'}>{micOn ? '🎙️ On' : '🎤 Off'}</Button>
              <Button type="button" variant="outline" onClick={() => { setMuted((m) => !m); stopSpeaking() }} aria-label={muted ? 'Unmute AI voice' : 'Mute AI voice'}>{muted ? '🔇' : '🔊'}</Button>
            </form>
            {micError && (
              <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{micError}</span>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={startMic} disabled={busy || micOn}>Retry microphone</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void reportAudioLost()} disabled={busy}>Stop and report audio lost</Button>
                </div>
              </AlertDescription></Alert>
            )}
            <Button variant="outline" size="sm" onClick={() => void leave()} disabled={busy}>Leave conversation</Button>
          </>
        )}

        {ended && <p className="text-sm">This conversation has ended and the transcript was saved. You can close this page.</p>}
      </CardContent>
    </Card>
  )
}
