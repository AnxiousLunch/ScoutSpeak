'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { SessionMessage } from './SessionRoom'

interface Props {
  sessionId: string
  leadName: string
  sessionStatus: string
  initialMessages: SessionMessage[]
}

export function ProspectHost({ sessionId, leadName, sessionStatus, initialMessages }: Props) {
  const [status, setStatus] = useState(sessionStatus)
  const [messages, setMessages] = useState(initialMessages)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const ended = ['completed', 'cancelled', 'failed'].includes(status)

  useEffect(() => {
    if (ended) return
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/messages`, { cache: 'no-store' })
        if (!res.ok) return
        const body = (await res.json()) as { status: string; messages: SessionMessage[] }
        if (!cancelled) { setStatus(body.status); setMessages(body.messages) }
      } catch { /* keep last known transcript */ }
    }
    const timer = setInterval(poll, 3000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [sessionId, ended])

  async function createLink() {
    setBusy(true); setError(null); setCopied(false)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/invite`, { method: 'POST' })
      const body = (await res.json()) as { url?: string; status?: string; message?: string }
      if (!res.ok || !body.url) throw new Error(body.message || 'Could not create the link.')
      setUrl(body.url)
      if (body.status) setStatus(body.status)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the link.')
    } finally { setBusy(false) }
  }

  async function copy() {
    if (!url) return
    try { await navigator.clipboard.writeText(url); setCopied(true) } catch { setError('Copy failed. Select the link and copy it manually.') }
  }

  return (
    <div className="session-room">
      <div className="session-room-heading">
        <div><p className="eyebrow">PROSPECT CONVERSATION</p><h1>Conversation with {leadName}</h1><p>Share the link. The prospect talks to the AI representative; you watch the transcript live.</p></div>
        <Link href="/sessions" className="back-link">← All conversations</Link>
      </div>
      <Card className="room-card">
        <CardHeader>
          <div className="room-title-row">
            <div><CardTitle>Invite link</CardTitle><CardDescription>The link works once created for 24 hours and is shown only once.</CardDescription></div>
            <span className={`session-status-pill ${status}`}>{status.replaceAll('_', ' ')}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertTitle>Couldn’t complete that step</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {!ended && (
            <div className="space-y-2">
              <Button onClick={() => void createLink()} disabled={busy || status === 'active'}>{busy ? 'Creating…' : url ? 'Create a new link' : 'Create link'}</Button>
              {url && (
                <div className="flex gap-2">
                  <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
                  <Button type="button" variant="outline" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</Button>
                </div>
              )}
            </div>
          )}
          <div className="transcript" aria-live="polite" aria-label="Live transcript (read-only)">
            {messages.length === 0 && <div className="transcript-empty"><b>No messages yet</b><small>The transcript appears here once the prospect starts.</small></div>}
            {messages.map((m) => (
              <div key={m.sequence_number} className={`transcript-message ${m.speaker_role === 'agent' ? 'agent-message' : 'human-message'}`}>
                <span>{m.speaker_role === 'agent' ? 'AI REPRESENTATIVE' : 'PROSPECT'}</span><p>{m.message_text}</p>
              </div>
            ))}
          </div>
          {ended && <p>This conversation has ended and the transcript is saved.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
