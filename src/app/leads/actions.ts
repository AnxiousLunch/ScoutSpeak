'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import {
  manualLeadSchema,
  normalizeUrl,
  leadStatusValues,
  type ManualLeadFormValues,
  type LeadStatus,
} from '@/lib/validation'
import { SAMPLE_LEADS } from '@/lib/sample-leads'

function validateLeadInput(values: ManualLeadFormValues) {
  const parsed = manualLeadSchema.safeParse(values)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.errors.map((e) => e.message).join('. ') }
  }
  return { success: true as const, data: parsed.data }
}

async function requireUser() {
  const supabase = createClient()
  const { data: user, error } = await supabase.auth.getUser()
  if (error || !user.user) {
    return null
  }
  return { supabase, userId: user.user.id }
}

async function requireOwnedCampaign(userId: string, campaignId: string, supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('owner_id', userId)
    .single()

  return !error && !!data
}

export type LeadActionResult = { success: true } | { success: false; error: string }

export async function addLead(
  campaignId: string,
  values: ManualLeadFormValues
): Promise<LeadActionResult> {
  const parsed = validateLeadInput(values)
  if (!parsed.success) return parsed

  const auth = await requireUser()
  if (!auth) return { success: false, error: 'You must be signed in.' }

  const owned = await requireOwnedCampaign(auth.userId, campaignId, auth.supabase)
  if (!owned) return { success: false, error: 'Campaign not found.' }

  const { error } = await auth.supabase.from('leads').insert({
    owner_id: auth.userId,
    campaign_id: campaignId,
    company_name: parsed.data.company_name.trim(),
    website_url: parsed.data.website_url.trim(),
    research_status: 'unverified',
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/leads')
  return { success: true }
}

export async function deleteLead(id: string): Promise<LeadActionResult> {
  const auth = await requireUser()
  if (!auth) return { success: false, error: 'You must be signed in.' }

  const { error } = await auth.supabase
    .from('leads')
    .delete()
    .eq('id', id)
    .eq('owner_id', auth.userId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/leads')
  return { success: true }
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus
): Promise<LeadActionResult> {
  if (!leadStatusValues.includes(status)) {
    return { success: false, error: 'Invalid status.' }
  }

  const auth = await requireUser()
  if (!auth) return { success: false, error: 'You must be signed in.' }

  const { error } = await auth.supabase
    .from('leads')
    .update({ lead_status: status })
    .eq('id', id)
    .eq('owner_id', auth.userId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/leads')
  return { success: true }
}

export async function loadSampleLeads(campaignId: string): Promise<LeadActionResult & { count?: number }> {
  const auth = await requireUser()
  if (!auth) return { success: false, error: 'You must be signed in.' }

  const owned = await requireOwnedCampaign(auth.userId, campaignId, auth.supabase)
  if (!owned) return { success: false, error: 'Campaign not found.' }

  const { data: existing } = await auth.supabase
    .from('leads')
    .select('website_url')
    .eq('campaign_id', campaignId)
    .eq('owner_id', auth.userId)

  const existingUrls = new Set((existing ?? []).map((l) => normalizeUrl(l.website_url ?? '')))
  const toInsert = SAMPLE_LEADS.filter((l) => !existingUrls.has(normalizeUrl(l.website_url)))

  if (toInsert.length === 0) {
    return { success: true, count: 0 }
  }

  const { error } = await auth.supabase.from('leads').insert(
    toInsert.map((lead) => ({
      owner_id: auth.userId,
      campaign_id: campaignId,
      company_name: lead.company_name,
      website_url: lead.website_url,
      research_status: 'unverified' as const,
    }))
  )

  if (error) return { success: false, error: error.message }

  revalidatePath('/leads')
  return { success: true, count: toInsert.length }
}

export interface CsvImportRow {
  company_name: string
  website_url: string
}

export async function importCsvLeads(
  campaignId: string,
  rows: CsvImportRow[]
): Promise<LeadActionResult & { count?: number }> {
  const auth = await requireUser()
  if (!auth) return { success: false, error: 'You must be signed in.' }

  const owned = await requireOwnedCampaign(auth.userId, campaignId, auth.supabase)
  if (!owned) return { success: false, error: 'Campaign not found.' }

  if (rows.length === 0) return { success: false, error: 'No rows to import.' }
  if (rows.length > 500) return { success: false, error: 'Too many rows.' }

  const { data: existing } = await auth.supabase
    .from('leads')
    .select('website_url')
    .eq('campaign_id', campaignId)
    .eq('owner_id', auth.userId)

  const existingUrls = new Set((existing ?? []).map((l) => normalizeUrl(l.website_url ?? '')))
  const accepted = rows.filter((row) => !existingUrls.has(normalizeUrl(row.website_url)))

  if (accepted.length === 0) {
    return { success: true, count: 0 }
  }

  const { error } = await auth.supabase.from('leads').insert(
    accepted.map((row) => ({
      owner_id: auth.userId,
      campaign_id: campaignId,
      company_name: row.company_name.trim(),
      website_url: row.website_url.trim(),
      research_status: 'unverified' as const,
    }))
  )

  if (error) return { success: false, error: error.message }

  revalidatePath('/leads')
  return { success: true, count: accepted.length }
}
