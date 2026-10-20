'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { saveReview, type SaveReviewInput } from './actions'

const OUTCOMES = [
  'interested',
  'follow_up',
  'meeting_requested',
  'not_interested',
  'not_a_fit',
  'unclear',
] as const

interface Message {
  sequence_number: number
  speaker_role: string
  message_text: string | null
}

interface ReviewClientProps {
  sessionId: string
  leadName: string
  purpose: string
  messages: Message[]
  existingReview: Record<string, unknown> | null
}

export function ReviewClient({ sessionId, leadName, purpose, messages, existingReview }: ReviewClientProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggested, setSuggested] = useState<Record<string, unknown> | null>(
    existingReview?.outcome_suggested ? (existingReview as Record<string, unknown>) : null
  )
  const [summary, setSummary] = useState(
    typeof existingReview?.summary === 'string' ? existingReview.summary : ''
  )
  const [outcome, setOutcome] = useState(
    typeof existingReview?.outcome_confirmed === 'string'
      ? existingReview.outcome_confirmed
      : typeof existingReview?.outcome_suggested === 'string'
      ? existingReview.outcome_suggested
      : ''
  )
  const [tags, setTags] = useState(
    Array.isArray(existingReview?.objection_tags) ? existingReview.objection_tags.join(', ') : ''
  )
  const [nextStep, setNextStep] = useState(
    typeof existingReview?.next_step === 'string' ? existingReview.next_step : ''
  )

  async function handleExtract() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/outcome`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.message || data.error || 'Outcome extraction failed.')
        return
      }
      setSuggested(data.review)
      setSummary(data.review.summary ?? '')
      setOutcome(data.review.outcome_suggested ?? '')
      setTags((data.review.objection_tags ?? []).join(', '))
      setNextStep(data.review.next_step ?? '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Outcome extraction failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    if (!outcome || !OUTCOMES.includes(outcome as typeof OUTCOMES[number])) {
      setError('Choose a valid outcome.')
      return
    }

    setBusy(true)
    setError(null)

    const source = suggested
      ? outcome === suggested.outcome_suggested
        ? 'user_confirmed'
        : 'user_corrected'
      : 'user_corrected'

    const result = await saveReview({
      sessionId,
      purpose,
      summary,
      outcome_suggested: typeof suggested?.outcome_suggested === 'string' ? suggested.outcome_suggested : outcome,
      outcome_confirmed: outcome,
      outcome_source: source,
      objection_tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      next_step: nextStep,
      quality_notes: { objection_handling: '', missed_opportunities: '' },
      excerpts: Array.isArray(suggested?.excerpts) ? suggested.excerpts : [],
    })

    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    router.push('/sessions')
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/sessions/${sessionId}`} className="hover:underline">← Session</Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Review conversation</h1>
        <p className="text-muted-foreground">{leadName} · {purpose.replace('_', ' ')}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Suggested outcome</CardTitle>
          <CardDescription>
            {suggested ? 'Review the model suggestion and correct it if needed.' : 'Extract a suggested outcome from the transcript.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!suggested && (
            <Button onClick={handleExtract} disabled={busy}>
              {busy ? 'Extracting…' : 'Suggest outcome'}
            </Button>
          )}

          {suggested && (
            <>
              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outcome">Confirmed outcome</Label>
                <select
                  id="outcome"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2"
                >
                  {OUTCOMES.map((o) => (
                    <option key={o} value={o}>{o.replace('_', ' ')}</option>
                  ))}
                </select>
                {typeof suggested.outcome_suggested === 'string' && (
                  <p className="text-xs text-muted-foreground">
                    Suggested: {String(suggested.outcome_suggested).replace('_', ' ')}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Objection tags (comma separated)</Label>
                <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next_step">Next step</Label>
                <Input id="next_step" value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
              </div>
              {Array.isArray(suggested.excerpts) && suggested.excerpts.length > 0 && (
                <div className="space-y-2">
                  <Label>Supporting excerpts</Label>
                  <ul className="space-y-2 text-sm">
                    {(suggested.excerpts as Array<{ point: string; message_seq: number[] }>).map((excerpt, i) => (
                      <li key={i} className="rounded-md border p-2">
                        <p>{excerpt.point}</p>
                        <p className="text-muted-foreground">Messages: {excerpt.message_seq.join(', ')}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button onClick={handleSave} disabled={busy}>
                {busy ? 'Saving…' : 'Save review'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {messages.map((m) => (
            <div key={m.sequence_number} className="text-sm">
              <span className="font-medium">{m.speaker_role === 'agent' ? 'AI' : 'Prospect'}</span>
              <span className="text-muted-foreground"> #{m.sequence_number}</span>
              <p>{m.message_text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
