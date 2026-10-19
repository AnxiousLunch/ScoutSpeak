'use client'

import { useState, useTransition } from 'react'
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

interface Lead {
  id: string
  company_name: string
  website_url: string | null
  research_status: string
  lead_status: string | null
  fit_score: number | null
}

interface LeadsClientProps {
  leads: Lead[]
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

export function LeadsClient({ leads, campaignId, error }: LeadsClientProps) {
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
      <Card>
        <CardHeader>
          <CardTitle>No campaign yet</CardTitle>
          <CardDescription>
            Create a campaign before adding leads.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  function handleAction(result: LeadActionResult & { count?: number }, successMessage: string) {
    if (result.success) {
      setFormSuccess(successMessage)
      setFormError(null)
    } else {
      setFormError(result.error)
      setFormSuccess(null)
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
      })
    })
  }

  function handleDelete(id: string) {
    setDeleteId(null)
    startTransition(() => {
      deleteLead(id).then((result) => handleAction(result, 'Lead deleted.'))
    })
  }

  function handleStatusChange(id: string, value: string) {
    if (!value) return
    const status = value as LeadStatus
    startTransition(() => {
      updateLeadStatus(id, status).then((result) => handleAction(result, 'Status updated.'))
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
      })
    })
  }

  async function handleCsvFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setCsvFile(file ?? null)
    setCsvPreview([])
    setCsvError(null)
    setCsvReport(null)

    if (!file) return

    const { rows, error } = await parseCsvPreview(file)
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
    const result = await importCsvLeads(
      campaignId!,
      csvReport.accepted.map((r) => ({
        company_name: r.company_name,
        website_url: r.website_url,
      }))
    )
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
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
                  Columns: company_name, website_url (or name/company, website/url). Max{' '}
                  {CSV_MAX_ROWS} rows, {Math.round(CSV_MAX_SIZE_BYTES / 1024 / 1024)} MB.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
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
              </DialogHeader>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company name</Label>
                  <Input id="company_name" name="company_name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website_url">Website URL</Label>
                  <Input
                    id="website_url"
                    name="website_url"
                    type="url"
                    placeholder="https://example.com"
                    required
                  />
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
                <TableHead>Fit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.company_name}</TableCell>
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
                  <TableCell className="text-right">
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
                    </Dialog>
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
