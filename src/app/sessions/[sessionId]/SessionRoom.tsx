'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { speak, stopSpeaking, isBrowserSpeechSupported, createBrowserSpeechRecognition, type SpeechRecognitionType } from '@/lib/voice/browser-speech'
import { type SessionBrief } from '@/lib/sessions/prompt'

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
  participantConsentAt: string | null
  brief: unknown
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
  participantConsentAt,
  brief,
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
  const recognitionRef = useRef<SpeechRecognitionType | null>(null)
  const latestTextRef = useRef(text)
  const ended = status === 'completed' || status === 'cancelled' || status === 'failed'
  const parsedBrief = parseBrief(brief)

  useEffect(() => {
    latestTextRef.current = text
  }, [text])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMicSupported(isBrowserSpeechSupported())
    }
  }, [])

  useEffect(() => {
    return () => {
      stopSpeaking()
      stopRecognition()
    }
  }, [])

  useEffect(() => {
    if (ended) {
      stopRecognition()
      stopSpeaking()
    }
  }, [ended])

  function stopRecognition() {
    try {
      recognitionRef.current?.stop()
    } catch {
      // ignore
    }
    recognitionRef.current = null
  }

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
      stopRecognition()
      speak(textToSpeak)
      if (window.speechSynthesis.speaking) {
        const checkDone = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            clearInterval(checkDone)
            if (micOn && !ended) {
              startMic()
            }
          }
        }, 250)
      } else if (micOn && !ended) {
        startMic()
      }
    } else if (micOn && !ended) {
      startMic()
    }
  }

  async function start() {
    setBusy(true); setError(null)
    try {
      if (!consentAt) {
        throw new Error('Please confirm the AI disclosure and transcript notice before starting.')
      }
      const result = await request({ action: 'start', inputMethod: 'typed' })
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
    setBusy(true); setError(null); stopRecognition()
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

  function startMic() {
    if (!isBrowserSpeechSupported()) {
      setMicSupported(false)
      setMicError('Speech recognition is not supported in this browser. Typed input is always available.')
      return
    }
    setMicError(null)
    try {
      const recognition = createBrowserSpeechRecognition({
        onPartial: (partial) => {
          setText((current) => {
            const base = current.replace(/\.\.\.$/, '').trim()
            return base ? `${base} ${partial}…` : `${partial}…`
          })
        },
        onFinal: (final) => {
          setText((current) => {
            const base = current.replace(/\.\.\.$/, '').trim()
            const next = base ? `${base} ${final}` : final
            void send(next, 'voice_browser')
            return next
          })
        },
        onError: (err) => {
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            setMicError('Microphone access was denied. Check browser permissions and try again.')
          } else if (err === 'no-speech') {
            setMicError('No speech was detected. Try speaking closer to the mic.')
          } else if (err === 'audio-capture') {
            setMicError('No microphone found. Typed input is always available.')
          } else {
            setMicError(`Speech recognition error: ${err}. Try again.`)
          }
          setMicOn(false)
        },
        onEnd: () => {
          setMicOn(false)
        },
      })
      recognitionRef.current = recognition
      recognition.start()
      setMicOn(true)
    } catch (cause) {
      setMicError(cause instanceof Error ? cause.message : 'Could not start speech recognition.')
      setMicOn(false)
    }
  }

  function toggleMic() {
    if (micOn) {
      stopRecognition()
      setMicOn(false)
      setMicError(null)
    } else {
      if (typeof window !== 'undefined' && window.speechSynthesis.speaking) {
        return
      }
      startMic()
    }
  }

  async function end() {
    setBusy(true); setError(null); stopRecognition(); stopSpeaking()
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
      <div className="session-room-heading"><div><p className="eyebrow">{PURPOSE_LABEL[sessionStatus] || 'CONVERSATION'} · CONSULTATIVE</p><h1>Practice with {leadName}</h1><p>The AI plays your sales representative. You play the prospect.</p></div><Link href="/sessions" className="back-link">← All conversations</Link></div>
      <div className="session-context-strip"><span><b>Campaign goal</b>{campaignObjective || 'Understand the prospect and find a useful next step.'}</span><span><b>Lead context</b>{evidenceCount ? `${evidenceCount} saved source excerpt${evidenceCount === 1 ? '' : 's'}` : `${leadStatus} · no inspected evidence yet`}</span></div>
      {leadStatus !== 'verified' && <Alert className="context-alert"><AlertTitle>Limited lead context</AlertTitle><AlertDescription>This lead is {leadStatus} and has {evidenceCount ? 'only limited stored evidence' : 'no stored website evidence yet'}. The AI will avoid making claims about the company and ask open questions instead.</AlertDescription></Alert>}
      <Card className="room-card"><CardHeader><div className="room-title-row"><div><CardTitle>Conversation</CardTitle><CardDescription>{status === 'created' ? 'Confirm the disclosure, then start when you’re ready.' : status === 'active' ? 'Voice and typed replies are saved as you go. Nothing is recorded as audio.' : 'This conversation is complete and saved.'}</CardDescription></div><span className={`session-status-pill ${status}`}>{status.replaceAll('_', ' ')}</span></div></CardHeader>
        <CardContent>
          <div className="transcript" aria-live="polite" aria-label="Conversation transcript">
            {messages.length === 0 && status === 'created' && <div className="transcript-empty"><span>◌</span><b>Your transcript will appear here</b><small>Start the conversation to see the AI’s opening, then reply as the prospect.</small></div>}
            {messages.map((message) => <div key={message.sequence_number} className={`transcript-message ${message.speaker_role === 'agent' ? 'agent-message' : 'human-message'}`}><span>{message.speaker_role === 'agent' ? 'AI REPRESENTATIVE' : 'YOU · PROSPECT'}</span><p>{message.message_text}</p></div>)}
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
                <Button type="button" variant="outline" onClick={toggleMic} disabled={busy || !micSupported} aria-label={micOn ? 'Turn microphone off' : 'Turn microphone on'}>
                  {micOn ? '🎙️ On' : '🎤 Off'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute AI voice' : 'Mute AI voice'}>
                  {muted ? '🔇' : '🔊'}
                </Button>
              </form>
              {micError && <Alert className="mt-2" variant="destructive"><AlertDescription>{micError}</AlertDescription></Alert>}
              <div className="room-bottom-row"><span>{micOn ? 'Voice input active' : 'Typed input'} · transcript saved · no audio stored</span><Button variant="outline" size="sm" onClick={end} disabled={busy}>End conversation</Button></div>
            </>
          )}
          {ended && <div className="room-actions"><p>This transcript is saved. You can find it in Conversations.</p><Button asChild variant="outline"><Link href="/sessions">View conversations</Link></Button></div>}
        </CardContent>
      </Card>
    </div>
  )
}

function parseBrief(brief: unknown): SessionBrief | null {
  if (typeof brief !== 'object' || brief === null) return null
  const candidate = brief as Record<string, unknown>
  if (
    typeof candidate.goal === 'string' &&
    Array.isArray(candidate.priority_questions) &&
    candidate.priority_questions.every((q) => typeof q === 'string') &&
    Array.isArray(candidate.end_conditions) &&
    candidate.end_conditions.every((c) => typeof c === 'string') &&
    Array.isArray(candidate.permitted_claims)
  ) {
    return candidate as SessionBrief
  }
  return null
}
