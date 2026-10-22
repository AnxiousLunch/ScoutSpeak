'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge, type BadgeProps } from '@/components/ui/badge'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/components/ToastViewport'
import Link from 'next/link'
import {
  leadStatusValues,
  type LeadStatus,
  manualLeadSchema,
  type ManualLeadFormValues,
} from '@/lib/validation'
import { parseCsvPreview, buildImportReport, CSV_MAX_SIZE_BYTES, CSV_MAX_ROWS } from '@/lib/csv-import'
import {
  addLead,
  deleteLead,
  updateLeadStatus,
  loadSampleLeads,
  importCsvLeads,
  type LeadActionResult,
} from './actions'

interface CampaignOption {
  id: string
  name: string
}

interface Lead {
  id: string
  company_name: string
  website_url: string | null
  research_status: string
  lead_status: string | null
  fit_score: number | null
  fit_label: string | null
  enriched_at: string | null
  discovery_source: string | null
}

interface DiscoveryResult {
  providerId: string | null
  name: string
  category: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  websiteUrl: string | null
  phone: string | null
  source: string
  attribution: Record<string, unknown>
}

interface LeadsClientProps {
  leads: Lead[]
  campaigns: CampaignOption[]
  campaignId: string | null
  error?: string
}

const researchStatusVariant = (status: string): BadgeProps['variant'] => {
  switch (status) {
    case 'verified':
      return 'default'
    case 'partial':
      return 'secondary'
    default:
      return 'outline'
  }
}

const statusOptions = [
  { value: '', label: '—' },
  ...leadStatusValues.map((s) => ({
    value: s,
    label: s.charAt(0).toUpperCase() + s.slice(1),
  })),
]

export function LeadsClient({ leads, campaigns, campaignId, error }: LeadsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [manualOpen, setManualOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<Awaited<ReturnType<typeof parseCsvPreview>>['rows']>([])
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvReport, setCsvReport] = useState<ReturnType<typeof buildImportReport> | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [enrichingId, setEnrichingId] = useState<string | null>(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaignId ?? '')
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')
  const [discoverLimit, setDiscoverLimit] = useState(10)
  const [discovering, setDiscovering] = useState(false)
  const [discoverResults, setDiscoverResults] = useState<DiscoveryResult[] | null>(null)
  const [discoverError, setDiscoverError] = useState<string | null>(null)
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importReport, setImportReport] = useState<{ found: number; imported: number; skipped: number; rejected: number } | null>(null)

  async function handleEnrich(leadId: string, force = false) {
    setEnrichingId(leadId)
    try {
      const res = await fetch(`/api/leads/${leadId}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        notify(data.message || 'Enrichment failed. Please try again.', 'error')
      } else if (data.skipped) {
        notify('Lead is already enriched for the current profile version.', 'success')
      } else {
        notify(data.status === 'verified' ? 'Lead enriched.' : 'Lead enrichment complete.', 'success')
      }
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Enrichment failed. Please try again.', 'error')
    } finally {
      setEnrichingId(null)
      router.refresh()
    }
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading leads</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!campaignId) {
    return (
      <Card className="prerequisite-card">
        <CardHeader>
          <span className="guide-mark">02</span>
          <CardTitle>Create a campaign before adding leads</CardTitle>
          <CardDescription>
            Campaigns keep prospects together around a shared goal. Give your outreach a focus, then add the companies you want to research.
          </CardDescription>
        </CardHeader>
        <CardContent><Button asChild><Link href="/campaigns">Set up a campaign <span className="ml-2">→</span></Link></Button></CardContent>
      </Card>
    )
  }

  function handleAction(result: LeadActionResult & { count?: number }, successMessage: string) {
    if (result.success) {
      setFormSuccess(successMessage)
      setFormError(null)
      notify(successMessage, 'success')
    } else {
      setFormError(result.error)
      setFormSuccess(null)
      notify(result.error, 'error')
    }
  }

  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setFormSuccess(null)

    const formData = new FormData(event.currentTarget)
    const values: ManualLeadFormValues = {
      company_name: String(formData.get('company_name') ?? ''),
      website_url: String(formData.get('website_url') ?? ''),
    }

    const parsed = manualLeadSchema.safeParse(values)
    if (!parsed.success) {
      setFormError(parsed.error.errors.map((e) => e.message).join('. '))
      return
    }

    const form = event.currentTarget
    startTransition(() => {
        addLead(campaignId!, parsed.data).then((result) => {
        handleAction(result, 'Lead added.')
        if (result.success) {
          setManualOpen(false)
          form.reset()
        }
      }).catch((cause) => handleAction({ success: false, error: cause instanceof Error ? cause.message : 'Could not add this lead. Please try again.' }, ''))
    })
  }

  function handleDelete(id: string) {
    setDeleteId(null)
    startTransition(() => {
      deleteLead(id).then((result) => handleAction(result, 'Lead deleted.')).catch((cause) => handleAction({ success: false, error: cause instanceof Error ? cause.message : 'Could not delete this lead. Please try again.' }, ''))
    })
  }

  function handleStatusChange(id: string, value: string) {
    if (!value) return
    const status = value as LeadStatus
    startTransition(() => {
      updateLeadStatus(id, status).then((result) => handleAction(result, 'Status updated.')).catch((cause) => handleAction({ success: false, error: cause instanceof Error ? cause.message : 'Could not update the lead. Please try again.' }, ''))
    })
  }

  function handleSampleLoad() {
    setFormError(null)
    setFormSuccess(null)
    startTransition(() => {
      loadSampleLeads(campaignId!).then((result) => {
        if (result.success && result.count === 0) {
          handleAction(result, 'Sample leads already loaded.')
        } else {
          handleAction(result, `${result.count} sample lead(s) loaded.`)
        }
      }).catch((cause) => handleAction({ success: false, error: cause instanceof Error ? cause.message : 'Could not load sample leads. Please try again.' }, ''))
    })
  }

  function handlePractice(leadId: string) {
    router.push(`/leads/${leadId}`)
  }

  async function handleDiscover() {
    if (!selectedCampaignId) return
    setDiscovering(true)
    setDiscoverError(null)
    setDiscoverResults(null)
    setSelectedResults(new Set())
    setImportReport(null)
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: selectedCampaignId, keyword, location, limit: discoverLimit }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Discovery search failed.')
      setDiscoverResults(data.results ?? [])
    } catch (cause) {
      setDiscoverError(cause instanceof Error ? cause.message : 'Discovery search failed.')
    } finally {
      setDiscovering(false)
    }
  }

  async function handleImportSelected() {
    if (!selectedCampaignId || !discoverResults || selectedResults.size === 0) return
    setImporting(true)
    setImportReport(null)
    try {
      const toImport = discoverResults.filter((_, index) => selectedResults.has(index))
      const res = await fetch('/api/discover/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: selectedCampaignId, results: toImport }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Import failed.')
      setImportReport(data)
      setDiscoverResults(null)
      setSelectedResults(new Set())
      router.refresh()
    } catch (cause) {
      setDiscoverError(cause instanceof Error ? cause.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  function toggleResult(index: number) {
    setSelectedResults((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  async function handleCsvFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setCsvFile(file ?? null)
    setCsvPreview([])
    setCsvError(null)
    setCsvReport(null)

    if (!file) return

    let preview: Awaited<ReturnType<typeof parseCsvPreview>>
    try {
      preview = await parseCsvPreview(file)
    } catch (cause) {
      setCsvError(cause instanceof Error ? cause.message : 'Could not read this CSV file.')
      return
    }
    const { rows, error } = preview
    if (error) {
      setCsvError(error)
      return
    }
    setCsvPreview(rows)
    const report = buildImportReport(
      rows,
      leads.map((l) => l.website_url ?? '')
    )
    setCsvReport(report)
  }

  async function handleCsvImport() {
    if (!csvReport || csvReport.accepted.length === 0) return
    setCsvImporting(true)
    let result: LeadActionResult & { count?: number }
    try {
    result = await importCsvLeads(
      campaignId!,
      csvReport.accepted.map((r) => ({
        company_name: r.company_name,
        website_url: r.website_url,
      }))
    )
    } catch (cause) {
      setCsvError(cause instanceof Error ? cause.message : 'Import failed. Please try again.')
      setCsvImporting(false)
      return
    }
    setCsvImporting(false)
    if (result.success) {
      setCsvOpen(false)
      setCsvFile(null)
      setCsvPreview([])
      setCsvReport(null)
      handleAction(result, `${result.count} lead(s) imported.`)
    } else {
      setCsvError(result.error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="guided-page-heading"><p className="eyebrow">STEP 3 · BUILD YOUR PROSPECT LIST</p><h1>Leads</h1><p>Add companies you may want to work with. Public website pages provide context for later research; ScoutSpeak marks missing evidence clearly rather than filling gaps with guesses.</p></div>
      <div className="lead-status-guide"><span className="guide-mark">i</span><p><strong>Reading the table:</strong> Research shows whether there’s enough source evidence; lead status is your own follow-up tracking. A fit score helps prioritize attention, it does not predict a sale.</p></div>

      <Card>
        <CardHeader>
          <CardTitle>Discover businesses</CardTitle>
          <CardDescription>
            Search OpenStreetMap for public businesses by keyword and location. Results depend on local tagging coverage; a business without a website can still be saved as an unverified lead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="campaign-select">Campaign</Label>
              <Select
                id="campaign-select"
                value={selectedCampaignId}
                options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
                onChange={(value) => setSelectedCampaignId(value)}
                disabled={campaigns.length === 0}
              />
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="keyword">Business type</Label>
              <Input
                id="keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. accounting firms"
                disabled={discovering}
              />
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Karachi, Pakistan"
                disabled={discovering}
              />
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="limit">Max results</Label>
              <Input
                id="limit"
                type="number"
                min={1}
                max={25}
                value={discoverLimit}
                onChange={(e) => setDiscoverLimit(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
                disabled={discovering}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => void handleDiscover()}
              disabled={discovering || !selectedCampaignId || !keyword.trim() || !location.trim()}
            >
              {discovering ? 'Searching…' : 'Search'}
            </Button>
            {discoverResults && (
              <Button
                variant="outline"
                onClick={() => void handleImportSelected()}
                disabled={importing || selectedResults.size === 0}
              >
                {importing ? 'Importing…' : `Import selected (${selectedResults.size})`}
              </Button>
            )}
          </div>
          {discoverError && (
            <Alert variant="destructive">
              <AlertTitle>Discovery failed</AlertTitle>
              <AlertDescription>{discoverError}</AlertDescription>
            </Alert>
          )}
          {importReport && (
            <Alert>
              <AlertTitle>Import complete</AlertTitle>
              <AlertDescription>
                Found {importReport.found}, imported {importReport.imported}, skipped {importReport.skipped}, rejected {importReport.rejected}.
              </AlertDescription>
            </Alert>
          )}
          {discoverResults && discoverResults.length === 0 && !discoverError && (
            <p className="text-sm text-muted-foreground">No businesses found. Try a broader or better-known business category/location, or add leads manually.</p>
          )}
          {discoverResults && discoverResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Select the results you want to import. Attribution: OpenStreetMap contributors.</p>
              {discoverResults.map((result, index) => (
                <div key={index} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={selectedResults.has(index)}
                    onChange={() => toggleResult(index)}
                    aria-label={`Select ${result.name}`}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{result.name}</p>
                    <p className="text-muted-foreground">{result.category ?? 'Business'}{result.address ? ` · ${result.address}` : ''}</p>
                    {result.websiteUrl && (
                      <a href={result.websiteUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                        {result.websiteUrl}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {leads.length} lead{leads.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleSampleLoad} disabled={isPending}>
            Load sample leads
          </Button>
          <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={isPending}>
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import leads from CSV</DialogTitle>
                <DialogDescription>
                  Add a header row with <code>company_name</code> and <code>website_url</code>. We also recognize name/company and website/url. Keep URLs public and include http:// or https://. Max{' '}
                  {CSV_MAX_ROWS} rows, {Math.round(CSV_MAX_SIZE_BYTES / 1024 / 1024)} MB.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="csv-example"><span>Example header row</span><code>company_name,website_url</code><span>Example lead row</span><code>Acme Outfitters,https://acme.example</code></div>
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileChange}
                  disabled={csvImporting}
                />

                {csvError && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{csvError}</AlertDescription>
                  </Alert>
                )}

                {csvReport && (
                  <div className="space-y-2 text-sm">
                    <p>
                      Accepted: {csvReport.accepted.length} · Rejected:{" "}
                      {csvReport.rejected.length} · Duplicates:{" "}
                      {csvReport.deduplicated.length}
                    </p>
                    <p className="text-muted-foreground">Only accepted rows will be added. New leads start as unverified until evidence is available.</p>
                    {csvReport.rejected.length > 0 && (
                      <div className="max-h-32 overflow-auto rounded-md border p-2">
                        {csvReport.rejected.map((r) => (
                          <p key={r.rowIndex} className="text-destructive">
                            Row {r.rowIndex}: {r.reasons.join(', ')}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCsvImport}
                  disabled={csvImporting || !csvReport || csvReport.accepted.length === 0}
                >
                  {csvImporting ? 'Importing…' : 'Import accepted'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={manualOpen} onOpenChange={setManualOpen}>
            <DialogTrigger asChild>
              <Button disabled={isPending}>Add lead</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add lead manually</DialogTitle>
                <DialogDescription>Add a company and its public website. ScoutSpeak uses the URL as a source for company context; inaccessible pages may leave the lead unverified.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company name <span className="required-label">Required</span></Label>
                  <Input id="company_name" name="company_name" required placeholder="e.g. Acme Outfitters" aria-describedby="lead-name-help" />
                  <p id="lead-name-help" className="form-hint">Use the public business name shown on its website.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website_url">Public website <span className="required-label">Required</span></Label>
                  <Input
                    id="website_url"
                    name="website_url"
                    type="url"
                    placeholder="https://example.com"
                    required
                    aria-describedby="lead-url-help"
                  />
                  <p id="lead-url-help" className="form-hint">Use the company’s public homepage or a relevant public page. We don’t ask for contact details.</p>
                </div>
                <DialogFooter>
                  <Button type="submit">Add</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {formSuccess && (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{formSuccess}</AlertDescription>
        </Alert>
      )}

      {formError && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {isPending && leads.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : leads.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No leads yet</CardTitle>
            <CardDescription>
              Add leads manually, import a CSV, or load the sample data set.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Research</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="text-right">Next step</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">
                    <Link href={`/leads/${lead.id}`} className="hover:underline">
                      {lead.company_name}
                    </Link>
                    {lead.discovery_source && (
                      <span className="ml-2 text-xs text-muted-foreground">({lead.discovery_source})</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.website_url ? (
                      <a
                        href={lead.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {lead.website_url}
                      </a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={researchStatusVariant(lead.research_status)}>
                      {lead.research_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={lead.lead_status ?? ''}
                      options={statusOptions}
                      onChange={(value) => handleStatusChange(lead.id, value)}
                      disabled={isPending}
                    />
                  </TableCell>
                  <TableCell>
                    {lead.fit_score !== null && lead.fit_score !== undefined
                      ? lead.fit_score
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {lead.fit_label ? (
                      <Badge variant={lead.fit_label === 'excluded' ? 'destructive' : 'secondary'}>
                        {lead.fit_label}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="lead-row-actions">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEnrich(lead.id, !!lead.enriched_at)}
                        disabled={enrichingId === lead.id || isPending}
                      >
                        {enrichingId === lead.id ? 'Enriching…' : lead.enriched_at ? 'Re-enrich' : 'Enrich'}
                      </Button>
                      <Button size="sm" onClick={() => handlePractice(lead.id)} disabled={isPending}>
                        {isPending ? 'Opening…' : 'Practice'}
                      </Button>
                      <Dialog
                      open={deleteId === lead.id}
                      onOpenChange={(open) => setDeleteId(open ? lead.id : null)}
                    >
                      <DialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          Delete
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete lead</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete {lead.company_name}? This cannot
                            be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDeleteId(null)}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleDelete(lead.id)}
                          >
                            Delete
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog></div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
