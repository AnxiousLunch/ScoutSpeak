'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  isMediaRecorderSupported,
  pickMimeType,
  startRecording,
  speakServer,
  stopServerSpeech,
  isServerSpeechPlaying,
  isSpeechError,
  createSpeechError,
  type RecordingHandle,
  type SpeechErrorCode,
} from '@/lib/voice/server-speech'

export interface SessionMessage {
  sequence_number: number
  speaker_role: string
  message_text: string | null
}

interface SessionRoomProps {
  sessionId: string
  leadName: string
  leadStatus: string
  evidenceCount: number
  campaignObjective: string | null
  sessionStatus: string
  sessionPurpose: string
  participantConsentAt: string | null
  initialMessages: SessionMessage[]
}

const PURPOSE_LABEL: Record<string, string> = {
  rehearsal: 'PRIVATE REHEARSAL',
  prospect_conversation: 'PROSPECT CONVERSATION',
}

export function SessionRoom({
  sessionId,
  leadName,
  leadStatus,
  evidenceCount,
  campaignObjective,
  sessionStatus,
  sessionPurpose,
  participantConsentAt,
  initialMessages,
}: SessionRoomProps) {
  const [messages, setMessages] = useState(initialMessages)
  const [status, setStatus] = useState(sessionStatus)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consentAt, setConsentAt] = useState<string | null>(participantConsentAt)
  const [recordingConsent, setRecordingConsent] = useState(false)
  const [muted, setMuted] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [micSupported, setMicSupported] = useState(true)
  const ended = status === 'completed' || status === 'cancelled' || status === 'failed'
  const micOnRef = useRef(micOn)
  const endedRef = useRef(ended)
  const mountedRef = useRef(true)
  const micBusyRef = useRef(false)
  const mediaRef = useRef<RecordingHandle | null>(null)

  useEffect(() => {
    micOnRef.current = micOn
  }, [micOn])

  useEffect(() => {
    endedRef.current = ended
  }, [ended])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMicSupported(isMediaRecorderSupported())
    }
  }, [])

  useEffect(() => {
    return () => {
      mediaRef.current?.cancel()
      stopServerSpeech()
    }
  }, [])

  useEffect(() => {
    if (ended) {
      mediaRef.current?.cancel()
      stopServerSpeech()
    }
  }, [ended])

  async function recordConsent() {
    const response = await fetch(`/api/sessions/${sessionId}/consent`, { method: 'POST' })
    const result = (await response.json()) as { participant_consent_at?: string; error?: string }
    if (!response.ok) {
      throw new Error(result.error || 'Could not record consent.')
    }
    setConsentAt(result.participant_consent_at ?? new Date().toISOString())
  }

  async function request(body: Record<string, unknown>) {
    const response = await fetch(`/api/sessions/${sessionId}/turn`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const result = await response.json() as {
      message?: SessionMessage | string
      messageText?: string
      saved?: boolean
      status?: string
      ended?: boolean
      error?: string
    }
    if (!response.ok) {
      if (response.status === 409 && result.error === 'consent_required') {
        setConsentAt(null)
        setRecordingConsent(false)
      }
      throw new Error(typeof result.message === 'string' ? result.message : result.error || 'The request failed. Please retry.')
    }
    return result
  }

  function speakMessage(textToSpeak: string) {
    if (!muted && textToSpeak && typeof window !== 'undefined') {
      mediaRef.current?.cancel()
      void speakServer(sessionId, textToSpeak, {
        onEnd: () => {
          if (mountedRef.current && micOnRef.current && !endedRef.current) {
            void startMic()
          }
        },
        onError: (err) => {
          setMicError(formatSpeechError(err.code))
        },
      }).catch(() => { /* error already handled in onError */ })
    } else if (micOn && !ended) {
      void startMic()
    }
  }

  function formatSpeechError(code: SpeechErrorCode): string {
    switch (code) {
      case 'rate_limit':
        return 'Voice is temporarily rate-limited. Type your reply or retry in a moment.'
      case 'timeout':
        return 'Transcription timed out. Try a shorter reply.'
      case 'upstream':
        return 'Voice service is unavailable right now. Typed input still works.'
      case 'network':
        return "Couldn't reach the server. Check your connection and retry."
      case 'permission':
        return 'Microphone access was denied. Check browser permissions.'
      case 'empty':
        return 'No speech detected — try again.'
      default:
        return 'Voice input encountered an error. Typed input is always available.'
    }
  }

  function playMessage(textToSpeak: string) {
    setMuted(false)
    mediaRef.current?.cancel()
    void speakServer(sessionId, textToSpeak, {
      onEnd: () => {
        if (mountedRef.current && micOnRef.current && !endedRef.current) {
          void startMic()
        }
      },
      onError: () => {
        setMicError('Speech playback is not available. You can still read the transcript.')
      },
    }).catch(() => { /* error already handled in onError */ })
  }

  async function start() {
    setBusy(true); setError(null)
    try {
      if (!consentAt) {
        throw new Error('Please confirm the AI disclosure and transcript notice before starting.')
      }
      const inputMethod = 'typed'
      const result = await request({ action: 'start', inputMethod })
      const opening = result.message && typeof result.message !== 'string' ? result.message as SessionMessage : null
      if (opening) {
        setMessages((current) => current.some((item) => item.sequence_number === opening.sequence_number) ? current : [...current, opening])
        speakMessage(opening.message_text ?? '')
      }
      setStatus('active')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start this rehearsal.') }
    finally { setBusy(false) }
  }

  async function send(submittedText: string, inputMethod: 'voice_browser' | 'typed') {
    if (!submittedText || busy) return
    setBusy(true); setError(null); mediaRef.current?.cancel(); stopServerSpeech()
    setText('')
    try {
      const result = await request({ action: 'turn', text: submittedText, inputMethod })
      if (result.message && typeof result.message !== 'string') {
        const agentMessage = result.message as SessionMessage
        const humanMessage: SessionMessage = { sequence_number: agentMessage.sequence_number - 1, speaker_role: 'human', message_text: submittedText }
        setMessages((current) => [...current.filter((item) => item.sequence_number !== humanMessage.sequence_number && item.sequence_number !== agentMessage.sequence_number), humanMessage, agentMessage])
        speakMessage(agentMessage.message_text ?? '')
      }
      if (result.ended) setStatus(result.status ?? 'completed')
    } catch (cause) {
      setText(submittedText)
      setError(`${cause instanceof Error ? cause.message : 'The AI could not reply.'} Your message is kept in the box so you can retry.`)
    } finally { setBusy(false) }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitted = text.trim()
    if (!submitted) return
    void send(submitted, 'typed')
  }

  async function startMic() {
    if (micBusyRef.current) return
    micBusyRef.current = true
    setMicError(null)
    try {
      if (typeof window === 'undefined' || !isMediaRecorderSupported()) {
        setMicSupported(false)
        setMicError('Recording is not supported in this browser.')
        return
      }
      const mime = pickMimeType()
      if (!mime) {
        setMicError('No supported audio format in this browser.')
        return
      }
      const handle = await startRecording({ maxDurationMs: 60000, mimeType: mime })
      mediaRef.current = handle
      setMicOn(true)
      const blob = await handle.stop()
      mediaRef.current = null
      setMicOn(false)
      if (!mountedRef.current || endedRef.current) return
      if (blob.size < 1000) {
        setMicError('That was too short — try again.')
        return
      }
      setBusy(true)
      const extension = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'
      const fd = new FormData()
      fd.append('audio', blob, `recording.${extension}`)
      const res = await fetch(`/api/sessions/${sessionId}/transcribe`, {
        method: 'POST',
        body: fd,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; text?: string }
      if (!res.ok) {
        const code: SpeechErrorCode = res.status === 429 ? 'rate_limit' : 'upstream'
        throw createSpeechError(code, data.error ?? 'Transcription failed.')
      }
      const text = (data.text ?? '').trim()
      if (!text) {
        setMicError('No speech detected — try again.')
        return
      }
      await send(text, 'voice_browser')
    } catch (e) {
      if (isSpeechError(e)) {
        setMicError(formatSpeechError(e.code))
      } else {
        setMicError(e instanceof Error ? e.message : 'Could not record audio.')
      }
    } finally {
      micBusyRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }

  function toggleMic() {
    if (micOn) {
      mediaRef.current?.cancel()
      mediaRef.current = null
      setMicOn(false)
      setMicError(null)
    } else {
      if (isServerSpeechPlaying()) return
      void startMic()
    }
  }

  async function end() {
    setBusy(true); setError(null)
    mediaRef.current?.cancel()
    mediaRef.current = null
    stopServerSpeech()
    try {
      const result = await request({ action: 'end' })
      setStatus(result.status ?? 'completed')
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not end this session.') }
    finally { setBusy(false) }
  }

  const consentChecked = recordingConsent || !!consentAt

  return (
    <div className="session-room">
      <div className="session-room-heading"><div><p className="eyebrow">{PURPOSE_LABEL[sessionPurpose] || 'CONVERSATION'} · CONSULTATIVE</p><h1>Practice with {leadName}</h1><p>The AI plays your sales representative. You play the prospect.</p></div><Link href="/sessions" className="back-link">← All conversations</Link></div>
      <div className="session-context-strip"><span><b>Campaign goal</b>{campaignObjective || 'Understand the prospect and find a useful next step.'}</span><span><b>Lead context</b>{evidenceCount ? `${evidenceCount} saved source excerpt${evidenceCount === 1 ? '' : 's'}` : `${leadStatus} · no inspected evidence yet`}</span></div>
      {leadStatus !== 'verified' && <Alert className="context-alert"><AlertTitle>Limited lead context</AlertTitle><AlertDescription>This lead is {leadStatus} and has {evidenceCount ? 'only limited stored evidence' : 'no stored website evidence yet'}. The AI will avoid making claims about the company and ask open questions instead.</AlertDescription></Alert>}
      <Card className="room-card"><CardHeader><div className="room-title-row"><div><CardTitle>Conversation</CardTitle><CardDescription>{status === 'created' ? 'Confirm the disclosure, then start when you’re ready.' : status === 'active' ? 'Voice and typed replies are saved as you go. Nothing is recorded as audio.' : 'This conversation is complete and saved.'}</CardDescription></div><span className={`session-status-pill ${status}`}>{status.replaceAll('_', ' ')}</span></div></CardHeader>
        <CardContent>
          <div className="transcript" aria-live="polite" aria-label="Conversation transcript">
            {messages.length === 0 && status === 'created' && <div className="transcript-empty"><span>◌</span><b>Your transcript will appear here</b><small>Start the conversation to see the AI’s opening, then reply as the prospect.</small></div>}
            {messages.map((message) => <div key={message.sequence_number} className={`transcript-message ${message.speaker_role === 'agent' ? 'agent-message' : 'human-message'}`}><span>{message.speaker_role === 'agent' ? 'AI REPRESENTATIVE' : 'YOU · PROSPECT'}</span><p>{message.message_text}</p>{message.speaker_role === 'agent' && message.message_text && <Button type="button" size="sm" variant="outline" onClick={() => playMessage(message.message_text!)}>▶ Play aloud</Button>}</div>)}
            {busy && status === 'active' && <div className="reply-wait"><span className="typing-dots">•••</span> ScoutSpeak is preparing a grounded reply…</div>}
          </div>
          {error && <Alert variant="destructive" className="mt-4"><AlertTitle>Couldn’t complete that step</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {status === 'created' && (
            <div className="room-actions space-y-4">
              <div className="rounded-md border p-4 space-y-3">
                <p className="text-sm font-medium">Before you begin</p>
                <p className="text-sm text-muted-foreground">
                  You are speaking with an AI representative. The transcript is saved to this workspace. No audio is stored. You may leave at any time.
                </p>
                <div className="flex items-start gap-2">
                  <input
                    id="consent"
                    type="checkbox"
                    checked={consentChecked}
                    onChange={async (event) => {
                      const checked = event.target.checked
                      setRecordingConsent(checked)
                      if (checked && !consentAt) {
                        try {
                          await recordConsent()
                        } catch (cause) {
                          setRecordingConsent(false)
                          setError(cause instanceof Error ? cause.message : 'Could not record consent.')
                        }
                      }
                    }}
                    disabled={busy}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="consent" className="text-sm font-normal leading-none">
                    I understand and agree to the AI disclosure and transcript notice.
                  </Label>
                </div>
              </div>
              <Button onClick={start} disabled={busy || !consentAt}>{busy ? 'Starting…' : 'Start conversation'}</Button>
            </div>
          )}
          {status === 'active' && (
            <>
              <form className="reply-form" onSubmit={handleSubmit}>
                <Input value={text} onChange={(event) => setText(event.target.value)} placeholder="Reply as the prospect…" maxLength={500} disabled={busy} aria-label="Your reply as the prospect"/>
                <Button type="submit" disabled={busy || !text.trim()}>{busy ? 'Waiting…' : 'Send reply'}</Button>
                <Button type="button" variant="outline" onClick={toggleMic} disabled={busy || !micSupported || isServerSpeechPlaying()} aria-label={micOn ? 'Turn microphone off' : 'Turn microphone on'}>
                  {micOn ? '🎙️ On' : '🎤 Off'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute AI voice' : 'Mute AI voice'}>
                  {muted ? '🔇' : '🔊'}
                </Button>
              </form>
              {micError && (
            <Alert className="mt-2" variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{micError}</span>
                {micSupported && !ended && (
                  <Button type="button" variant="outline" size="sm" onClick={startMic} disabled={busy || micOn}>
                    Retry microphone
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
              <div className="room-bottom-row"><span>{micOn ? 'Voice input active' : 'Typed input'} · transcript saved · no audio stored</span><Button variant="outline" size="sm" onClick={end} disabled={busy}>End conversation</Button></div>
            </>
          )}
          {ended && <div className="room-actions"><p>This transcript is saved. You can find it in Conversations.</p><Button asChild variant="outline"><Link href="/sessions">View conversations</Link></Button></div>}
        </CardContent>
      </Card>
    </div>
  )
}


