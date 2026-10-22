'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { SessionSetup } from '../SessionSetup'
import type { Json } from '@/utils/supabase/database.types'

interface Evidence {
  id: string
  source_url: string | null
  canonical_url: string | null
  access_status: string | null
  page_title: string | null
  excerpt: string | null
  observed_at: string | null
}

interface Lead {
  id: string
  company_name: string
  website_url: string | null
  company_summary: string | null
  observed_signal: string | null
  inferred_need: string | null
  personalization_hook: string | null
  fit_score: number | null
  fit_label: string | null
  fit_reason: string | null
  research_status: string
  score_breakdown: Json | null
  missing_fields: Json | null
  citations: Json | null
  enrichment_error: string | null
}

interface LeadDetailClientProps {
  lead: Lead
  evidence: Evidence[]
  error?: string
}

type Claim = {
  label: 'Fact' | 'Inference' | 'Unknown'
  text: string
  tags: string[]
}

function jsonRecord(value: Json | null): Record<string, Json> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json>
    : {}
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'verified':
      return 'default'
    case 'partial':
      return 'secondary'
    case 'error':
    case 'blocked':
    case 'non_html':
    case 'not_found':
    case 'rate_limit':
    case 'server_error':
      return 'destructive'
    default:
      return 'outline'
  }
}

export function LeadDetailClient({ lead, evidence, error }: LeadDetailClientProps) {
  const router = useRouter()
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null)
  const [enriching, setEnriching] = useState(false)
  const [enrichError, setEnrichError] = useState<string | null>(null)
  const selectedEvidence = evidence.find((e) => e.id === selectedEvidenceId)

  async function handleEnrich() {
    setEnriching(true)
    setEnrichError(null)
    try {
      const response = await fetch(`/api/leads/${lead.id}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setEnrichError(result.message || result.error || 'Enrichment could not finish. Retry in a moment.')
        return
      }
      router.refresh()
    } catch (cause) {
      setEnrichError(cause instanceof Error ? cause.message : 'Enrichment could not finish. Retry in a moment.')
    } finally {
      setEnriching(false)
    }
  }

  const citations = jsonRecord(lead.citations)
  const evidenceById = new Map(evidence.map((e) => [e.id, e]))

  const claims: Claim[] = []
  if (lead.company_summary) {
    claims.push({ label: 'Fact', text: lead.company_summary, tags: (jsonRecord(lead.score_breakdown).summaryTags as string[] | undefined) ?? [] })
  }
  if (lead.observed_signal) {
    claims.push({ label: 'Fact', text: lead.observed_signal, tags: (jsonRecord(lead.score_breakdown).signalTags as string[] | undefined) ?? [] })
  }
  if (lead.inferred_need) {
    claims.push({ label: 'Inference', text: lead.inferred_need, tags: (jsonRecord(lead.score_breakdown).needTags as string[] | undefined) ?? [] })
  }
  if (lead.personalization_hook) {
    claims.push({ label: 'Unknown', text: lead.personalization_hook, tags: [] })
  }
  if (Array.isArray(lead.missing_fields) && lead.missing_fields.length > 0) {
    for (const field of lead.missing_fields) {
      if (typeof field !== 'string') continue
      claims.push({ label: 'Unknown', text: `Missing: ${field}`, tags: [] })
    }
  }

  const fit = lead.fit_label
    ? {
        score: lead.fit_score,
        label: lead.fit_label,
        reason: lead.fit_reason,
        unknowns: (jsonRecord(lead.score_breakdown).unknowns as string[] | undefined) ?? [],
        violated: (jsonRecord(lead.score_breakdown).violated_constraints as number[] | undefined) ?? [],
      }
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/leads" className="hover:underline">← Leads</Link>
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{lead.company_name}</h1>
          {lead.website_url && (
            <a
              href={lead.website_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              {lead.website_url}
            </a>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={lead.research_status === 'verified' ? 'default' : lead.research_status === 'partial' ? 'secondary' : 'outline'}>
            {lead.research_status}
          </Badge>
          <Button onClick={handleEnrich} disabled={enriching} variant="outline">
            {enriching ? 'Researching…' : lead.research_status === 'unverified' ? 'Retry research' : 'Refresh research'}
          </Button>
        </div>
      </div>

      {enrichError && (
        <Alert variant="destructive">
          <AlertTitle>Research could not finish</AlertTitle>
          <AlertDescription>{enrichError}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error loading evidence</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {lead.enrichment_error && (
        <Alert variant="destructive">
          <AlertTitle>Enrichment error</AlertTitle>
          <AlertDescription>{lead.enrichment_error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evidence</CardTitle>
            <CardDescription>
              Source pages collected for this lead. Inaccessible pages are kept so you can see what was tried.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {evidence.length === 0 ? (
              <p className="text-sm text-muted-foreground">No evidence collected yet.</p>
            ) : (
              evidence.map((row) => (
                <div key={row.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={row.source_url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-primary underline-offset-4 hover:underline"
                    >
                      {row.source_url}
                    </a>
                    <Badge variant={statusVariant(row.access_status ?? 'unknown')}>
                      {row.access_status ?? 'unknown'}
                    </Badge>
                  </div>
                  {row.page_title && <p className="mt-1 font-medium">{row.page_title}</p>}
                  {row.excerpt && (
                    <p className="mt-1 line-clamp-3 text-muted-foreground">{row.excerpt}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Claims</CardTitle>
              <CardDescription>
                Facts and inferences extracted from the evidence. Citation chips open the source excerpt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {claims.length === 0 ? (
                <p className="text-sm text-muted-foreground">No claims available.</p>
              ) : (
                claims.map((claim, index) => (
                  <div key={index} className="rounded-md border p-3 text-sm">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge
                        variant={
                          claim.label === 'Fact'
                            ? 'default'
                            : claim.label === 'Inference'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {claim.label}
                      </Badge>
                    </div>
                    <p>{claim.text}</p>
                    {claim.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {claim.tags.map((tag) => {
                          const citationId = citations[tag]
                          const uuid = typeof citationId === 'string' ? citationId : undefined
                          if (!uuid || !evidenceById.has(uuid)) return null
                          return (
                            <Button
                              key={tag}
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedEvidenceId(uuid)}
                            >
                              {tag}
                            </Button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {fit && (
            <Card>
              <CardHeader>
                <CardTitle>Fit breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{fit.score ?? '—'}</span>
                  <Badge
                    variant={
                      fit.label === 'strong'
                        ? 'default'
                        : fit.label === 'excluded'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {fit.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{fit.reason}</p>
                {fit.unknowns.length > 0 && (
                  <div>
                    <p className="text-sm font-medium">Unknown dimensions</p>
                    <p className="text-sm text-muted-foreground">{fit.unknowns.join(', ')}</p>
                  </div>
                )}
                {fit.violated.length > 0 && (
                  <div>
                    <p className="text-sm font-medium">Violated constraints</p>
                    <p className="text-sm text-muted-foreground">
                      Constraints #{fit.violated.join(', #')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <SessionSetup leadId={lead.id} />
        </div>
      </div>

      <Dialog open={!!selectedEvidenceId} onOpenChange={() => setSelectedEvidenceId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvidence?.page_title ?? 'Source excerpt'}</DialogTitle>
            <DialogDescription>{selectedEvidence?.source_url}</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-auto rounded-md border p-3 text-sm">
            {selectedEvidence?.excerpt ?? 'No excerpt available.'}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
