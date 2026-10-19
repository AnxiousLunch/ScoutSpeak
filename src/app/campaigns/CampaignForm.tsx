'use client'

import { useEffect, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { campaignSchema, type CampaignFormValues } from '@/lib/validation'
import { saveCampaign, type SaveCampaignResult } from './actions'

interface Campaign {
  id: string
  name: string
  objective: string | null
  status: string | null
}

interface CampaignFormProps {
  campaigns: Campaign[]
  canCreate: boolean
}

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
]

export function CampaignForm({ campaigns, canCreate }: CampaignFormProps) {
  const [isPending, setIsPending] = useState(false)
  const [result, setResult] = useState<SaveCampaignResult | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [editingId, setEditingId] = useState<string | undefined>(undefined)

  const editingCampaign = campaigns.find((c) => c.id === editingId)

  const [name, setName] = useState(editingCampaign?.name ?? '')
  const [objective, setObjective] = useState(editingCampaign?.objective ?? '')
  const [status, setStatus] = useState(editingCampaign?.status ?? 'draft')

  useEffect(() => {
    setName(editingCampaign?.name ?? '')
    setObjective(editingCampaign?.objective ?? '')
    setStatus(editingCampaign?.status ?? 'draft')
    setResult(null)
    setFieldErrors({})
  }, [editingCampaign])

  function startEdit(campaign: Campaign) {
    setEditingId(campaign.id)
  }

  function clearEdit() {
    setEditingId(undefined)
    setResult(null)
    setFieldErrors({})
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsPending(true)
    setResult(null)
    setFieldErrors({})

    const values: CampaignFormValues = {
      name: name.trim(),
      objective: objective.trim(),
      status: (status as CampaignFormValues['status']) || 'draft',
    }

    const parsed = campaignSchema.safeParse(values)
    if (!parsed.success) {
      const errors: Record<string, string[]> = {}
      parsed.error.errors.forEach((err) => {
        const path = String(err.path[0])
        errors[path] = errors[path] ?? []
        errors[path].push(err.message)
      })
      setFieldErrors(errors)
      setIsPending(false)
      return
    }

    const res = await saveCampaign(editingId, values)
    if (res.success) {
      setEditingId(undefined)
      setName('')
      setObjective('')
      setStatus('draft')
    } else if (res.fieldErrors) {
      setFieldErrors(res.fieldErrors)
    }
    setResult(res)
    setIsPending(false)
  }

  if (!canCreate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Create a business profile first to start a campaign.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Edit campaign' : 'New campaign'}</CardTitle>
          <CardDescription>
            {editingId
              ? 'Update the selected campaign. It stays linked to your latest profile version.'
              : 'Create a campaign linked to your latest business profile version.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign name</Label>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                aria-invalid={!!fieldErrors.name}
              />
              {fieldErrors.name?.map((msg) => (
                <p key={msg} className="text-sm text-destructive">
                  {msg}
                </p>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="objective">Objective</Label>
              <Textarea
                id="objective"
                name="objective"
                rows={3}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                name="status"
                options={statusOptions}
                value={status}
                onChange={(value) => setStatus(value)}
                disabled={isPending}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : editingId ? 'Update campaign' : 'Create campaign'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={clearEdit}>
                  Cancel
                </Button>
              )}
            </div>

            {result?.success && (
              <Alert>
                <AlertTitle>Saved</AlertTitle>
                <AlertDescription>
                  Campaign {editingId ? 'updated' : 'created'} successfully.
                </AlertDescription>
              </Alert>
            )}

            {result && !result.success && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing campaigns</CardTitle>
          <CardDescription>
            {campaigns.length === 0 ? 'No campaigns yet.' : `${campaigns.length} campaign(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create your first campaign above.
            </p>
          ) : (
            <ul className="space-y-2">
              {campaigns.map((campaign) => (
                <li
                  key={campaign.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div>
                    <span className="font-medium">{campaign.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      {campaign.status}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(campaign)}
                  >
                    Edit
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
