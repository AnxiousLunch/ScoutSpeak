'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { strategies, type StrategyKey } from '@/lib/strategies'
import { createSession, updateSessionBrief, type SessionPurpose } from '@/app/sessions/actions'
import { buildBrief } from '@/app/sessions/brief-actions'
import type { SessionBrief } from '@/lib/brief'

const purposeOptions = [
  { value: 'rehearsal', label: 'Rehearsal' },
  { value: 'prospect_conversation', label: 'Prospect conversation' },
]

const strategyOptions = strategies.map((s) => ({ value: s.key, label: s.label }))

interface SessionSetupProps {
  leadId: string
}

export function SessionSetup({ leadId }: SessionSetupProps) {
  const router = useRouter()
  const [objective, setObjective] = useState('')
  const [strategyKey, setStrategyKey] = useState<StrategyKey>('consultative')
  const [purpose, setPurpose] = useState<SessionPurpose>('rehearsal')
  const [objectionProfile, setObjectionProfile] = useState('')
  const [brief, setBrief] = useState<SessionBrief | null>(null)
  const [savedBrief, setSavedBrief] = useState<SessionBrief | null>(null)
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerateBrief() {
    setBusy(true)
    setError(null)
    const result = await buildBrief({ leadId, objective, strategyKey })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setBrief(result.brief)
  }

  async function handleSaveBrief() {
    if (!brief) {
      setError('Generate a brief first.')
      return
    }
    setBusy(true)
    setError(null)
    const result = savedSessionId
      ? await updateSessionBrief(savedSessionId, brief)
      : await createSession({ leadId, purpose, objective, strategyKey, objectionProfile, brief })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    if (!savedSessionId) {
      if (!('id' in result) || typeof result.id !== 'string') {
        setError('The session draft was not returned. Please retry.')
        return
      }
      setSavedSessionId(result.id)
    }
    setSavedBrief(brief)
  }

  function handleStart() {
    if (!savedSessionId) {
      setError('Save the brief before starting the session.')
      return
    }
    if (JSON.stringify(brief) !== JSON.stringify(savedBrief)) {
      setError('Save your latest brief changes before starting.')
      return
    }
    router.push(`/sessions/${savedSessionId}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prepare conversation</CardTitle>
        <CardDescription>
          Choose an objective, strategy and purpose. The brief is grounded in your profile and the lead evidence.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="objective">Objective</Label>
          <Input
            id="objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            disabled={!!savedSessionId}
            placeholder="e.g. Qualify interest and book a 15-minute discovery call"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="strategy">Strategy</Label>
            <Select
              id="strategy"
              value={strategyKey}
              options={strategyOptions}
              onChange={(value) => setStrategyKey(value as StrategyKey)}
              disabled={!!savedSessionId}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Select
              id="purpose"
              value={purpose}
              options={purposeOptions}
              onChange={(value) => setPurpose(value as SessionPurpose)}
              disabled={!!savedSessionId}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="objection_profile">Objection profile (optional)</Label>
          <Input
            id="objection_profile"
            value={objectionProfile}
            onChange={(e) => setObjectionProfile(e.target.value)}
            disabled={!!savedSessionId}
            placeholder="e.g. Price-sensitive, already has a vendor"
          />
        </div>

        <Button onClick={handleGenerateBrief} disabled={busy || !objective.trim()}>
          {busy && !brief ? 'Generating brief…' : 'Generate brief'}
        </Button>

        {brief && (
          <div className="space-y-4 rounded-md border p-4">
            <div className="space-y-2">
              <Label htmlFor="goal">Goal</Label>
              <Textarea
                id="goal"
                value={brief.goal}
                onChange={(e) => setBrief({ ...brief, goal: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority_questions">Priority questions</Label>
              <Textarea
                id="priority_questions"
                value={brief.priority_questions.join('\n')}
                onChange={(e) =>
                  setBrief({ ...brief, priority_questions: e.target.value.split('\n').filter(Boolean) })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_conditions">End conditions</Label>
              <Textarea
                id="end_conditions"
                value={brief.end_conditions.join('\n')}
                onChange={(e) =>
                  setBrief({ ...brief, end_conditions: e.target.value.split('\n').filter(Boolean) })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Permitted claims</Label>
              <ul className="space-y-1 text-sm">
                {brief.permitted_claims.map((claim, index) => (
                  <li key={index} className="rounded-md border p-2">
                    <span className="font-medium">{claim.source}:</span> {claim.claim}
                    {claim.source_id && <span className="text-muted-foreground"> ({claim.source_id})</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveBrief} disabled={busy} variant="outline">
                {busy ? 'Saving…' : savedSessionId ? 'Save brief' : 'Save brief'}
              </Button>
              <Button onClick={handleStart} disabled={busy || !savedSessionId || JSON.stringify(brief) !== JSON.stringify(savedBrief)}>
                Start session
              </Button>
            </div>
            {savedSessionId && (
              <p className="text-xs text-muted-foreground">Brief saved. Purpose and strategy are locked for this session.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
