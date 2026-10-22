import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import type { DiscoveryRecord } from '@/lib/discovery'
import type { Database } from '@/utils/supabase/database.types'

type SupabaseClient = ReturnType<typeof createClient>
type LeadInsert = Database['public']['Tables']['leads']['Insert']

export const runtime = 'nodejs'

const RecordSchema = z.object({
  providerId: z.string().nullable(),
  name: z.string().min(1),
  category: z.string().nullable(),
  address: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  websiteUrl: z.string().nullable(),
  phone: z.string().nullable(),
  source: z.string(),
  attribution: z.record(z.unknown()),
})

const RequestSchema = z.object({
  campaignId: z.string().uuid(),
  results: z.array(RecordSchema).min(1).max(50),
})

function normalizeWebsite(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const withScheme = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function dedupKey(record: DiscoveryRecord): string {
  if (record.providerId) {
    return `${record.source}:${record.providerId}`
  }
  const normalizedName = record.name.toLowerCase().trim().replace(/\s+/g, ' ')
  const locationHint = record.address?.toLowerCase().trim() ?? `${record.latitude ?? ''},${record.longitude ?? ''}`
  return `name:${normalizedName}:location:${locationHint}`
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ message: 'Sign in to continue.' }, { status: 401 })
  }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance?.currentLevel !== 'aal2') {
    return NextResponse.json({ message: 'Complete your two-factor check first.' }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ message: 'The request could not be read.' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.errors[0]?.message || 'Invalid import request.' }, { status: 400 })
  }

  const { campaignId, results } = parsed.data

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('owner_id', user.id)
    .single()

  if (campaignError || !campaign) {
    return NextResponse.json({ message: 'Campaign not found.' }, { status: 404 })
  }

  const importReport = await importRecords(supabase, user.id, campaignId, results)
  return NextResponse.json(importReport)
}

async function importRecords(
  client: SupabaseClient,
  ownerId: string,
  campaignId: string,
  results: DiscoveryRecord[]
): Promise<{ found: number; imported: number; skipped: number; rejected: number }> {
  const { data: existing } = await client
    .from('leads')
    .select('dedup_key')
    .eq('campaign_id', campaignId)
    .eq('owner_id', ownerId)

  const existingKeys = new Set(((existing ?? []) as { dedup_key: string | null }[]).map((l) => l.dedup_key).filter(Boolean))

  const inserts: LeadInsert[] = []
  const rejectedKeys = new Set<string>()

  for (const record of results) {
    if (!record.name.trim()) {
      rejectedKeys.add('empty_name')
      continue
    }

    const key = dedupKey(record)
    if (existingKeys.has(key)) continue

    const websiteUrl = normalizeWebsite(record.websiteUrl)
    inserts.push({
      owner_id: ownerId,
      campaign_id: campaignId,
      company_name: record.name.trim(),
      website_url: websiteUrl,
      research_status: 'unverified',
      provider_id: record.providerId,
      discovery_source: record.source,
      source_attribution: record.attribution,
      discovery_query: {},
      dedup_key: key,
    })
    existingKeys.add(key)
  }

  if (inserts.length === 0) {
    return { found: results.length, imported: 0, skipped: results.length - rejectedKeys.size, rejected: rejectedKeys.size }
  }

  const { error } = await client.from('leads').insert(inserts)
  if (error) {
    throw new Error(`Import failed: ${error.message}`)
  }

  return {
    found: results.length,
    imported: inserts.length,
    skipped: results.length - inserts.length - rejectedKeys.size,
    rejected: rejectedKeys.size,
  }
}
