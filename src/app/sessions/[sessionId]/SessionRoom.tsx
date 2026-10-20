'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

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
  initialMessages: SessionMessage[]
}

export function SessionRoom({ sessionId, leadName, leadStatus, evidenceCount, campaignObjective, sessionStatus, initialMessages }: SessionRoomProps) {
  const [messages, setMessages] = useState(initialMessages)
  const [status, setStatus] = useState(sessionStatus)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ended = status === 'completed' || status === 'cancelled' || status === 'failed'

  async function request(body: Record<string, string>) {
    const response = await fetch(`/api/sessions/${sessionId}/turn`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const result = await response.json() as { message?: SessionMessage | string; messageText?: string; saved?: boolean; status?: string; ended?: boolean }
    if (!response.ok) throw new Error(typeof result.message === 'string' ? result.message : 'The request failed. Please retry.')
    return result
  }

  async function start() {
    setBusy(true); setError(null)
    try {
      const result = await request({ action: 'start' })
      const opening = result.message && typeof result.message !== 'string' ? result.message as SessionMessage : null
      if (opening) setMessages((current) => current.some((item) => item.sequence_number === opening.sequence_number) ? current : [...current, opening])
      setStatus('active')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start this rehearsal.') }
    finally { setBusy(false) }
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitted = text.trim()
    if (!submitted || busy) return
    setBusy(true); setError(null)
    try {
      const result = await request({ action: 'turn', text: submitted })
      if (result.message && typeof result.message !== 'string') {
        const agentMessage = result.message as SessionMessage
        const humanMessage: SessionMessage = { sequence_number: agentMessage.sequence_number - 1, speaker_role: 'human', message_text: submitted }
        setMessages((current) => [...current.filter((item) => item.sequence_number !== humanMessage.sequence_number && item.sequence_number !== agentMessage.sequence_number), humanMessage, agentMessage])
      }
      if (result.ended) setStatus('completed')
      setText('')
    } catch (cause) {
      setError(`${cause instanceof Error ? cause.message : 'The AI could not reply.'} Your message is kept in the box so you can retry.`)
    } finally { setBusy(false) }
  }

  async function end() {
    setBusy(true); setError(null)
    try {
      const result = await request({ action: 'end' })
      setStatus(result.status ?? 'completed')
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not end this session.') }
    finally { setBusy(false) }
  }

  return <div className="session-room">
    <div className="session-room-heading"><div><p className="eyebrow">PRIVATE REHEARSAL · CONSULTATIVE</p><h1>Practice with {leadName}</h1><p>The AI plays your sales representative. You play the prospect.</p></div><Link href="/sessions" className="back-link">← All conversations</Link></div>
    <div className="session-context-strip"><span><b>Campaign goal</b>{campaignObjective || 'Understand the prospect and find a useful next step.'}</span><span><b>Lead context</b>{evidenceCount ? `${evidenceCount} saved source excerpt${evidenceCount === 1 ? '' : 's'}` : `${leadStatus} · no inspected evidence yet`}</span></div>
    {leadStatus !== 'verified' && <Alert className="context-alert"><AlertTitle>Limited lead context</AlertTitle><AlertDescription>This lead is {leadStatus} and has {evidenceCount ? 'only limited stored evidence' : 'no stored website evidence yet'}. The AI will avoid making claims about the company and ask open questions instead.</AlertDescription></Alert>}
    <Card className="room-card"><CardHeader><div className="room-title-row"><div><CardTitle>Conversation</CardTitle><CardDescription>{status === 'created' ? 'Start when you’re ready. This rehearsal is saved to your Sessions.' : status === 'active' ? 'Typed replies are saved as you go. Nothing is recorded as audio.' : 'This rehearsal is complete and saved.'}</CardDescription></div><span className={`session-status-pill ${status}`}>{status.replaceAll('_', ' ')}</span></div></CardHeader>
      <CardContent>
        <div className="transcript" aria-live="polite" aria-label="Conversation transcript">
          {messages.length === 0 && status === 'created' && <div className="transcript-empty"><span>◌</span><b>Your transcript will appear here</b><small>Start the rehearsal to see the AI’s opening, then reply as the prospect.</small></div>}
          {messages.map((message) => <div key={message.sequence_number} className={`transcript-message ${message.speaker_role === 'agent' ? 'agent-message' : 'human-message'}`}><span>{message.speaker_role === 'agent' ? 'AI REPRESENTATIVE' : 'YOU · PROSPECT'}</span><p>{message.message_text}</p></div>)}
          {busy && status === 'active' && <div className="reply-wait"><span className="typing-dots">•••</span> ScoutSpeak is preparing a grounded reply…</div>}
        </div>
        {error && <Alert variant="destructive" className="mt-4"><AlertTitle>Couldn’t complete that step</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        {status === 'created' && <div className="room-actions"><p>Practice conversations are private to your workspace. You can end one at any time.</p><Button onClick={start} disabled={busy}>{busy ? 'Starting…' : 'Start rehearsal'}</Button></div>}
        {status === 'active' && <><form className="reply-form" onSubmit={send}><Input value={text} onChange={(event) => setText(event.target.value)} placeholder="Reply as the prospect…" maxLength={500} disabled={busy} aria-label="Your reply as the prospect"/><Button type="submit" disabled={busy || !text.trim()}>{busy ? 'Waiting…' : 'Send reply'}</Button></form><div className="room-bottom-row"><span>Typed conversation · transcript saved · no audio stored</span><Button variant="outline" size="sm" onClick={end} disabled={busy}>End rehearsal</Button></div></>}
        {ended && <div className="room-actions"><p>This practice transcript is saved. You can find it in Conversations.</p><Button asChild variant="outline"><Link href="/sessions">View conversations</Link></Button></div>}
      </CardContent>
    </Card>
  </div>
}
