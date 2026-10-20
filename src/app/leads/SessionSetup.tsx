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
import { createSession, type SessionPurpose } from '@/app/sessions/actions'
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

  async function handleStart() {
    if (!brief) {
      setError('Generate a brief first.')
      return
    }
    setBusy(true)
    setError(null)
    const result = await createSession({
      leadId,
      purpose,
      objective,
      strategyKey,
      objectionProfile,
      brief,
    })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    router.push(`/sessions/${result.id}`)
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Select
              id="purpose"
              value={purpose}
              options={purposeOptions}
              onChange={(value) => setPurpose(value as SessionPurpose)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="objection_profile">Objection profile (optional)</Label>
          <Input
            id="objection_profile"
            value={objectionProfile}
            onChange={(e) => setObjectionProfile(e.target.value)}
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
            <Button onClick={handleStart} disabled={busy}>
              {busy ? 'Starting…' : 'Start session'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
