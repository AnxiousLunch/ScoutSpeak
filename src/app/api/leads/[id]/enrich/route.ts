import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getModelClient } from '@/lib/ai'
import { AiError } from '@/lib/ai/errors'
import { safeFetchPage } from '@/lib/net/safe-fetch'
import { extractPage } from '@/lib/net/extract'
import { FetchBlockedError } from '@/lib/net/errors'
import {
  enrichLead,
  type PageInput,
  type ProfileInput,
} from 'prospectkit'
import { randomUUID } from 'crypto'

const EXTRA_PATHS = ['/about', '/services', '/products', '/solutions']
const MAX_OK_PAGES = 3

interface EvidenceRow {
  id: string
  source_url: string
  canonical_url: string
  access_status: 'ok' | 'blocked' | 'error' | 'non_html'
  page_title: string | null
  excerpt: string | null
}

function aiStatus(code: AiError['code']): number {
  switch (code) {
    case 'rate_limit':
      return 429
    case 'timeout':
      return 504
    case 'provider_error':
      return 502
    default:
      return 500
  }
}

function pageStatusFromError(error: unknown): 'blocked' | 'error' | 'non_html' | 'not_found' | 'rate_limit' | 'server_error' {
  if (error instanceof FetchBlockedError) {
    if (error.code === 'non_html') return 'non_html'
    if (error.code === 'not_found') return 'not_found'
    if (error.code === 'rate_limit') return 'rate_limit'
    if (error.code === 'server_error') return 'server_error'
    return 'blocked'
  }
  return 'error'
}

function pageErrorMessage(error: unknown): string {
  if (error instanceof FetchBlockedError) return error.code
  if (error instanceof Error) return error.message
  return String(error)
}

function sameOriginUrls(origin: string): string[] {
  return EXTRA_PATHS.map((path) => `${origin.replace(/\/$/, '')}${path}`)
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let body: { force?: boolean } = {}
  try {
    body = (await request.json()) as { force?: boolean }
  } catch {
    body = {}
  }

  const [{ data: lead, error: leadError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase
        .from('leads')
        .select('*')
        .eq('id', params.id)
        .eq('owner_id', user.id)
        .single(),
      supabase
        .from('business_profiles')
        .select('*')
        .eq('owner_id', user.id)
        .order('version', { ascending: false })
        .limit(1)
        .single(),
    ])

  if (leadError || !lead) {
    return NextResponse.json({ error: 'lead_not_found' }, { status: 404 })
  }
  if (profileError || !profile) {
    return NextResponse.json({ error: 'profile_required' }, { status: 400 })
  }

  const existingVersion =
    (lead.score_breakdown as { profile_version?: number } | null)?.profile_version ?? null
  if (
    lead.enriched_at &&
    existingVersion === profile.version &&
    !body.force
  ) {
    return NextResponse.json({ skipped: true }, { status: 200 })
  }

  const runId = randomUUID()
  const evidenceRows: EvidenceRow[] = []

  async function recordEvidence(
    sourceUrl: string,
    attempt: () => Promise<{ title: string; text: string; finalUrl: string; status: number; contentType: string }>
  ): Promise<EvidenceRow> {
    const id = randomUUID()
    try {
      const fetched = await attempt()
      const row: EvidenceRow = {
        id,
        source_url: sourceUrl,
        canonical_url: fetched.finalUrl,
        access_status: 'ok',
        page_title: fetched.title || null,
        excerpt: fetched.text || null,
      }
      evidenceRows.push(row)
      return row
    } catch (error) {
      const row: EvidenceRow = {
        id,
        source_url: sourceUrl,
        canonical_url: sourceUrl,
        access_status: pageStatusFromError(error),
        page_title: null,
        excerpt: pageErrorMessage(error),
      }
      evidenceRows.push(row)
      return row
    }
  }


  if (lead.website_url) {
    await recordEvidence(lead.website_url, async () => {
      const fetched = await safeFetchPage(lead.website_url!)
      const extracted = extractPage(fetched.text)
      return {
        title: extracted.title,
        text: extracted.text,
        finalUrl: fetched.finalUrl,
        status: fetched.status,
        contentType: fetched.contentType,
      }
    })
  }

  if (lead.website_url) {
    let origin: string
    try {
      origin = new URL(lead.website_url).origin
    } catch {
      origin = ''
    }

    if (origin) {
      const extraUrls = sameOriginUrls(origin)
      let okCount = evidenceRows.filter((r) => r.access_status === 'ok').length

      for (const url of extraUrls) {
        if (okCount >= MAX_OK_PAGES) break
        const row = await recordEvidence(url, async () => {
          const fetched = await safeFetchPage(url)
          const extracted = extractPage(fetched.text)
          return {
            title: extracted.title,
            text: extracted.text,
            finalUrl: fetched.finalUrl,
            status: fetched.status,
            contentType: fetched.contentType,
          }
        })
        if (row.access_status === 'ok') okCount += 1
      }
    }
  }

  const evidenceInserts = evidenceRows.map((row) => ({
    id: row.id,
    owner_id: user.id,
    lead_id: lead.id,
    run_id: runId,
    source_url: row.source_url,
    canonical_url: row.canonical_url,
    page_title: row.page_title,
    excerpt: row.excerpt,
    observed_at: new Date().toISOString(),
    access_status: row.access_status,
  }))

  if (evidenceInserts.length > 0) {
    const { error: evidenceError } = await supabase.from('lead_evidence').insert(evidenceInserts)
    if (evidenceError) {
      return NextResponse.json({ error: 'evidence_insert_failed', message: evidenceError.message }, { status: 500 })
    }
  }

  const okRows = evidenceRows.filter((r) => r.access_status === 'ok')
  const tagToUuid: Record<string, string> = {}
  const pages: PageInput[] = okRows.slice(0, MAX_OK_PAGES).map((row, index) => {
    const tag = `E${index + 1}`
    tagToUuid[tag] = row.id
    return {
      tag,
      url: row.source_url,
      title: row.page_title ?? '',
      excerpt: row.excerpt ?? '',
    }
  })

  const profileInput: ProfileInput = {
    business_name: profile.business_name,
    services: profile.services,
    value_proposition: profile.value_proposition,
    target_industry: profile.target_industry,
    target_geography: profile.target_geography,
    constraints: profile.constraints,
  }

  let modelError: string | null = null
  let enrichment: Awaited<ReturnType<typeof enrichLead>> | null = null

  try {
    enrichment = await enrichLead({
      model: getModelClient(),
      profile: profileInput,
      lead: { company_name: lead.company_name, website_url: lead.website_url },
      pages,
    })
  } catch (error) {
    if (error instanceof AiError) {
      await supabase
        .from('leads')
        .update({
          research_status: 'unverified',
          enrichment_error: error.code,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id)
        .eq('owner_id', user.id)

      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: aiStatus(error.code) }
      )
    }
    modelError = error instanceof Error ? error.message : String(error)
  }

  if (!enrichment || !enrichment.result) {
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        research_status: 'unverified',
        enrichment_error: enrichment?.error ?? modelError ?? 'unverified',
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id)
      .eq('owner_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'lead_update_failed', message: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ result: null, status: 'unverified' }, { status: 200 })
  }

  const { result, fit, status } = enrichment

  const citations: Record<string, string> = {}
  for (const tag of [
    ...result.summary.evidence,
    ...result.observed_signal.evidence,
    ...(result.inferred_need?.evidence ?? []),
  ]) {
    const uuid = tagToUuid[tag]
    if (uuid) citations[tag] = uuid
  }

  const { error: updateError } = await supabase
    .from('leads')
    .update({
      company_summary: result.summary.text,
      observed_signal: result.observed_signal.text,
      inferred_need: result.inferred_need?.text ?? null,
      personalization_hook: result.opener,
      fit_score: fit?.score ?? null,
      fit_label: fit?.label ?? null,
      fit_reason: fit?.reason ?? null,
      score_breakdown: {
        profile_version: profile.version,
        summaryTags: result.summary.evidence,
        signalTags: result.observed_signal.evidence,
        needTags: result.inferred_need?.evidence ?? [],
        unknowns: fit?.unknowns ?? [],
        violated_constraints: result.violated_constraints,
        ...(fit?.breakdown ?? {}),
      },
      missing_fields: result.missing_fields,
      citations,
      research_status: status,
      enriched_at: new Date().toISOString(),
      enrichment_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lead.id)
    .eq('owner_id', user.id)

  if (updateError) {
    return NextResponse.json({ error: 'lead_update_failed', message: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ status, fit: fit?.label ?? null, score: fit?.score ?? null }, { status: 200 })
}
