'use client'

import { useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  createBrowserSpeechRecognition,
  isBrowserSpeechSupported,
  isSpeechSynthesisSupported,
  requestMicrophoneAccess,
  speak,
  stopSpeaking,
} from '@/lib/voice/browser-speech'
import type { SpeechRecognitionType } from '@/lib/voice/browser-speech'
import { isHostedSpeechSupported, createHostedSpeechRecognition } from '@/lib/voice/hosted-speech'

interface Turn {
  speaker: 'agent' | 'human'
  text: string
  inputMethod?: 'browser_speech' | 'typed'
}

type Status =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error'

export default function DevVoicePage() {
  const [started, setStarted] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [turns, setTurns] = useState<Turn[]>([])
  const [partial, setPartial] = useState('')
  const [typedText, setTypedText] = useState('')
  const [micEnabled, setMicEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryTurn, setRetryTurn] = useState<{
    text: string
    inputMethod: 'browser_speech' | 'typed'
  } | null>(null)
  const [speechMode, setSpeechMode] = useState<'browser' | 'hosted' | 'unsupported'>('browser')
  const recognitionRef = useRef<SpeechRecognitionType | null>(null)
  const micEnabledRef = useRef(micEnabled)
  const speechModeRef = useRef(speechMode)
  const speechSupported = isBrowserSpeechSupported() || isHostedSpeechSupported()

  useEffect(() => {
    micEnabledRef.current = micEnabled
  }, [micEnabled])

  useEffect(() => {
    speechModeRef.current = speechMode
  }, [speechMode])

  useEffect(() => {
    return () => {
      stopListening()
      stopSpeaking()
    }
  }, [])

  function stopListening() {
    try {
      recognitionRef.current?.abort()
    } catch {
      // ignore
    }
    recognitionRef.current = null
  }

  function appendTurn(turn: Turn) {
    setTurns((prev) => [...prev, turn])
  }

async function sendTurn(
    text: string,
    inputMethod: 'browser_speech' | 'typed'
  ) {
    setStatus('processing')
    setError(null)
    setRetryTurn({ text, inputMethod })

    const history = turns.slice(-6).map((turn) => ({
      speaker: turn.speaker,
      text: turn.text,
    }))

    try {
      const res = await fetch('/api/voice/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, text }),
      })

      const body = (await res.json()) as { reply?: string; error?: string; message?: string }

      if (!res.ok) {
        throw new Error(body.message || body.error || `HTTP ${res.status}`)
      }

      const reply = body.reply
      if (typeof reply !== 'string') {
        throw new Error('AI returned an empty reply.')
      }

      appendTurn({ speaker: 'human', text, inputMethod })
      appendTurn({ speaker: 'agent', text: reply })
      setStatus('speaking')
      speak(reply)
      setTimeout(() => {
        setStatus('idle')
        if (micEnabledRef.current) {
          startListening()
        }
      }, 500)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Turn failed.')
    }
  }

  async function startListening() {
    if (!speechSupported) return
    if (speechModeRef.current === 'unsupported') return

    if (speechModeRef.current === 'hosted' || !isBrowserSpeechSupported()) {
      startHostedListening()
      return
    }

    setError(null)
    setPartial('')

    try {
      await requestMicrophoneAccess()
      const recognition = createBrowserSpeechRecognition({
        onPartial: (text) => {
          setPartial(text)
          setStatus('listening')
        },
        onFinal: (text) => {
          if (text.trim()) {
            void sendTurn(text.trim(), 'browser_speech')
          }
          setPartial('')
        },
        onError: (err) => {
          setStatus('error')
          if (
            (err === 'network' || err === 'service-not-allowed') &&
            speechModeRef.current === 'browser' &&
            isHostedSpeechSupported()
          ) {
            setSpeechMode('hosted')
            speechModeRef.current = 'hosted'
            startHostedListening()
            return
          }
          if (err === 'not-allowed') {
            setError('Microphone access was denied. Use typed input instead.')
            setMicEnabled(false)
          } else if (err === 'audio-capture') {
            setError('No microphone was detected. Connect or enable one, or type your message.')
            setMicEnabled(false)
          } else if (err === 'no-speech') {
            setError('No speech was detected. Try again or type your message.')
          } else if (err === 'network') {
            setError('Speech recognition service is unavailable. Try again or type your message.')
          } else {
            setError(`Speech recognition error: ${err}`)
          }
        },
        onEnd: () => {
          recognitionRef.current = null
          if (status === 'listening') {
            setStatus('idle')
          }
        },
      })

      recognitionRef.current = recognition
      recognition.start()
      setStatus('listening')
    } catch (e) {
      if (isHostedSpeechSupported()) {
        setSpeechMode('hosted')
        speechModeRef.current = 'hosted'
        startHostedListening()
      } else {
        setStatus('error')
        setError(e instanceof Error ? e.message : 'Could not start microphone.')
        setMicEnabled(false)
      }
    }
  }

  function startHostedListening() {
    if (!isHostedSpeechSupported()) {
      setError('Hosted speech recognition is not supported in this browser. Use typed input.')
      setMicEnabled(false)
      setSpeechMode('unsupported')
      return
    }
    setError(null)
    setPartial('')
    setSpeechMode('hosted')
    const recognition = createHostedSpeechRecognition({
      onPartial: (text) => {
        setPartial(text)
        setStatus('listening')
      },
      onFinal: (text) => {
        if (text.trim()) {
          void sendTurn(text.trim(), 'browser_speech')
        }
        setPartial('')
      },
      onError: (err) => {
        setStatus('error')
        setError(`Speech recognition error: ${err}. Try again or type your message.`)
      },
      onEnd: () => {
        recognitionRef.current = null
        if (status === 'listening') {
          setStatus('idle')
        }
      },
    }, { maxRecordingMs: 8000 })

    recognitionRef.current = recognition
    recognition.start()
    setStatus('listening')
  }

  function stopListeningAndReset() {
    stopListening()
    setStatus('idle')
    setPartial('')
  }

  function handleMicToggle() {
    if (micEnabled) {
      setMicEnabled(false)
      stopListeningAndReset()
    } else {
      setMicEnabled(true)
      startListening()
    }
  }

  function handleStart() {
    setStarted(true)
    const greeting =
      "Hi, I'm an AI sales representative. This is a practice call. How can I help you today?"
    appendTurn({ speaker: 'agent', text: greeting })
    setStatus('speaking')
    speak(greeting)
    setTimeout(() => setStatus('idle'), 500)
    if (micEnabled) {
      startListening()
    }
  }

  function handleTypedSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = typedText.trim()
    if (!text || status === 'processing') return
    setTypedText('')
    void sendTurn(text, 'typed')
  }

  function handleRetry() {
    if (!retryTurn) return
    void sendTurn(retryTurn.text, retryTurn.inputMethod)
  }

  const isBusy = status === 'processing' || status === 'speaking'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Voice smoke test</h1>
        <p className="text-sm text-muted-foreground">
          Speak or type to the AI sales representative. Nothing is saved yet.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
          <CardDescription>
            {started
              ? 'The agent identifies itself as an AI. Use the mic toggle or type below.'
              : 'Start the conversation to hear the agent introduce itself.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!started && (
            <Button onClick={handleStart}>Start conversation</Button>
          )}

          <div className="space-y-2">
            {turns.map((turn, index) => (
              <div
                key={index}
                className={`rounded-md border p-3 ${
                  turn.speaker === 'agent'
                    ? 'bg-muted'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                  {turn.speaker === 'agent' ? 'AI' : 'You'}
                  {turn.inputMethod
                    ? ` · ${turn.inputMethod === 'browser_speech' ? 'voice' : 'typed'}`
                    : ''}
                </p>
                <p className="mt-1 text-sm">{turn.text}</p>
              </div>
            ))}

            {partial && (
              <div className="rounded-md border border-dashed p-3 opacity-70">
                <p className="text-xs font-medium uppercase tracking-wide">You · voice</p>
                <p className="mt-1 text-sm">{partial}</p>
              </div>
            )}

            {status === 'processing' && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}
          </div>

          {started && (
            <div className="flex flex-wrap items-end gap-3">
              {speechSupported ? (
                <Button
                  variant={micEnabled ? 'default' : 'outline'}
                  onClick={handleMicToggle}
                  disabled={isBusy}
                  aria-pressed={micEnabled}
                >
                  {micEnabled ? 'Stop mic' : 'Use microphone'} {speechMode === 'hosted' && <span className="text-xs opacity-60">(hosted)</span>}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Speech recognition is not supported in this browser. Typed input works
                  everywhere.
                </p>
              )}

              <form onSubmit={handleTypedSubmit} className="flex flex-1 gap-2">
                <div className="sr-only">
                  <Label htmlFor="typed-input">Type a message</Label>
                </div>
                <Input
                  id="typed-input"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  placeholder="Type a message…"
                  maxLength={500}
                  disabled={isBusy}
                  className="flex-1"
                />
                <Button type="submit" disabled={isBusy || !typedText.trim()}>
                  Send
                </Button>
              </form>
            </div>
          )}

          {status === 'listening' && (
            <p className="text-sm text-muted-foreground">Listening…</p>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{error}</p>
                {retryTurn && (
                  <Button variant="outline" size="sm" onClick={handleRetry}>
                    Retry last turn
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
