#!/usr/bin/env tsx
/**
 * Two-account isolation test for ScoutSpeak RLS + MFA.
 *
 * This script is the ONLY place the SUPABASE_SERVICE_ROLE_KEY is used.
 * It creates two pre-confirmed test users, enrols and verifies TOTP for both,
 * then asserts cross-account access is blocked at the database and API levels.
 */

import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { authenticator } from 'otplib'
import type { Database } from '../src/utils/supabase/database.types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceRoleKey) {
  console.error(
    'Missing environment variables. Set NEXT_PUBLIC_SUPABASE_URL, ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.'
  )
  process.exit(1)
}

const admin = createClient<Database>(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const password = 'TestPassword123!'

interface Workspace {
  ids: {
    profile: string
    campaign: string
    lead: string
    evidence: string
    session: string
    message: string
    review: string
    invite: string
  }
  jwt: string
}

interface TestResult {
  name: string
  pass: boolean
  detail?: string
}

const results: TestResult[] = []

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail })
}

async function createConfirmedUser(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  if (!data.user) throw new Error(`Failed to create user ${email}`)
  return data.user.id
}

async function signIn(email: string) {
  const client = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

async function enrollAndVerify(client: ReturnType<typeof createClient<Database>>) {
  const { data: factorsData } = await client.auth.mfa.listFactors()
  for (const factor of factorsData?.all?.filter((f) => f.status === 'unverified') ?? []) {
    await client.auth.mfa.unenroll({ factorId: factor.id }).catch(() => {})
  }

  const { data: factor, error: enrollError } = await client.auth.mfa.enroll({
    factorType: 'totp',
  })
  if (enrollError) throw enrollError
  if (!factor) throw new Error('MFA enrollment returned no factor')

  const code = authenticator.generate(factor.totp.secret)
  const { data: challenge, error: challengeError } =
    await client.auth.mfa.challenge({ factorId: factor.id })
  if (challengeError) throw challengeError
  if (!challenge) throw new Error('MFA challenge returned no challenge')

  const { error: verifyError } = await client.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code,
  })
  if (verifyError) throw verifyError

  return client
}

async function getJwt(client: ReturnType<typeof createClient<Database>>) {
  const { data } = await client.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Expected an access token but none was returned')
  return token
}

async function insertWorkspace(
  client: ReturnType<typeof createClient<Database>>,
  label: string
): Promise<Workspace> {
  const profile = await client
    .from('business_profiles')
    .insert({ business_name: `${label} Profile`, version: 1 })
    .select('id')
    .single()
  if (profile.error) throw profile.error

  const campaign = await client
    .from('campaigns')
    .insert({ business_profile_id: profile.data.id, name: `${label} Campaign` })
    .select('id')
    .single()
  if (campaign.error) throw campaign.error

  const lead = await client
    .from('leads')
    .insert({
      campaign_id: campaign.data.id,
      company_name: `${label} Lead`,
      research_status: 'verified',
    })
    .select('id')
    .single()
  if (lead.error) throw lead.error

  const evidence = await client
    .from('lead_evidence')
    .insert({ lead_id: lead.data.id, source_url: 'https://example.com' })
    .select('id')
    .single()
  if (evidence.error) throw evidence.error

  const session = await client
    .from('conversation_sessions')
    .insert({
      lead_id: lead.data.id,
      campaign_id: campaign.data.id,
      session_purpose: 'rehearsal',
      session_status: 'created',
      input_method: 'typed',
      strategy_key: 'consultative',
    })
    .select('id')
    .single()
  if (session.error) throw session.error

  const message = await client
    .from('conversation_messages')
    .insert({
      session_id: session.data.id,
      sequence_number: 1,
      speaker_role: 'agent',
      message_text: 'Hello',
    })
    .select('id')
    .single()
  if (message.error) throw message.error

  const review = await client
    .from('session_reviews')
    .insert({
      session_id: session.data.id,
      outcome_source: 'user_confirmed',
    })
    .select('id')
    .single()
  if (review.error) throw review.error

  const invite = await client
    .from('session_invites')
    .insert({
      session_id: session.data.id,
      token_hash: `${label}-${randomUUID()}`,

      expires_at: new Date(Date.now() + 3600000).toISOString(),
    })
    .select('id')
    .single()
  if (invite.error) throw invite.error

  const jwt = await getJwt(client)

  return {
    ids: {
      profile: profile.data.id,
      campaign: campaign.data.id,
      lead: lead.data.id,
      evidence: evidence.data.id,
      session: session.data.id,
      message: message.data.id,
      review: review.data.id,
      invite: invite.data.id,
    },
    jwt,
  }
}

async function restRequest(
  method: string,
  path: string,
  jwt: string | null,
  body?: Record<string, unknown>
) {
  const headers: Record<string, string> = {
    apikey: anonKey,
    Accept: 'application/json',
    Prefer: 'return=representation',
  }
  if (jwt) headers.Authorization = `Bearer ${jwt}`
  if (body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${url}/rest/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  let rows: unknown[] | null = null
  if (res.status !== 204) {
    try {
      const json = (await res.json()) as unknown
      rows = Array.isArray(json) ? json : null
    } catch {
      rows = null
    }
  }

  return { ok: res.ok, status: res.status, rows }
}

async function run() {
  const timestamp = Date.now()
  const emailA = `scout-isolation-a-${timestamp}@example.com`
  const emailB = `scout-isolation-b-${timestamp}@example.com`

  let idA = ''
  let idB = ''
  idA = await createConfirmedUser(emailA)
  idB = await createConfirmedUser(emailB)

  try {
    const aClient = await enrollAndVerify(await signIn(emailA))
    const bClient = await enrollAndVerify(await signIn(emailB))

    // AAL1 session for A: sign in again without completing the MFA challenge.
    const aAal1Client = await signIn(emailA)
    const jwtA1 = await getJwt(aAal1Client)

    const aWorkspace = await insertWorkspace(aClient, 'A')
    const bWorkspace = await insertWorkspace(bClient, 'B')

    // --- Positive checks: each user can read their own data ---
    const aProfiles = await aClient.from('business_profiles').select('*')
    record('A reads own business_profiles', (aProfiles.data?.length ?? 0) === 1)

    const bProfiles = await bClient.from('business_profiles').select('*')
    record('B reads own business_profiles', (bProfiles.data?.length ?? 0) === 1)

    // --- Negative checks: B cannot access A's rows via Supabase client ---
    const bReadsAProfile = await bClient
      .from('business_profiles')
      .select('*')
      .eq('id', aWorkspace.ids.profile)
    record(
      'B cannot select A profile via client',
      (bReadsAProfile.data?.length ?? 0) === 0 && bReadsAProfile.error === null
    )

    const bReadsALead = await bClient
      .from('leads')
      .select('*')
      .eq('id', aWorkspace.ids.lead)
    record(
      'B cannot select A lead via client',
      (bReadsALead.data?.length ?? 0) === 0 && bReadsALead.error === null
    )

    // --- Direct REST attacks by B against A's rows ---
    const tables = [
      { name: 'business_profiles', id: aWorkspace.ids.profile },
      { name: 'campaigns', id: aWorkspace.ids.campaign },
      { name: 'leads', id: aWorkspace.ids.lead },
      { name: 'lead_evidence', id: aWorkspace.ids.evidence },
      { name: 'conversation_sessions', id: aWorkspace.ids.session },
      { name: 'conversation_messages', id: aWorkspace.ids.message },
      { name: 'session_reviews', id: aWorkspace.ids.review },
      { name: 'session_invites', id: aWorkspace.ids.invite },
    ] as const

    for (const { name, id } of tables) {
      const read = await restRequest('GET', `/${name}?id=eq.${id}`, bWorkspace.jwt)
      record(
        `B cannot read A ${name} via REST`,
        !read.ok || (read.rows?.length ?? 0) === 0,
        `status=${read.status}`
      )

      if (name !== 'conversation_messages' && name !== 'session_invites') {
        const patch = await restRequest(
          'PATCH',
          `/${name}?id=eq.${id}`,
          bWorkspace.jwt,
          { updated_at: new Date().toISOString() }
        )
        record(
          `B cannot update A ${name} via REST`,
          !patch.ok || (patch.rows?.length ?? 0) === 0,
          `status=${patch.status}`
        )
      }

      if (name !== 'conversation_messages') {
        const del = await restRequest('DELETE', `/${name}?id=eq.${id}`, bWorkspace.jwt)
        record(
          `B cannot delete A ${name} via REST`,
          !del.ok || (del.rows?.length ?? 0) === 0,
          `status=${del.status}`
        )
      }
    }

    // --- conversation_messages has no direct update/delete for anyone ---
    const bUpdateMessage = await restRequest(
      'PATCH',
      `/conversation_messages?id=eq.${aWorkspace.ids.message}`,
      bWorkspace.jwt,
      { message_text: 'hacked' }
    )
    record(
      'B cannot update A conversation_messages via REST',
      !bUpdateMessage.ok || (bUpdateMessage.rows?.length ?? 0) === 0,
      `status=${bUpdateMessage.status}`
    )

    const bDeleteMessage = await restRequest(
      'DELETE',
      `/conversation_messages?id=eq.${aWorkspace.ids.message}`,
      bWorkspace.jwt
    )
    record(
      'B cannot delete A conversation_messages via REST',
      !bDeleteMessage.ok || (bDeleteMessage.rows?.length ?? 0) === 0,
      `status=${bDeleteMessage.status}`
    )

    // --- session_invites has no client update ---
    const bUpdateInvite = await restRequest(
      'PATCH',
      `/session_invites?id=eq.${aWorkspace.ids.invite}`,
      bWorkspace.jwt,
      { used_at: new Date().toISOString() }
    )
    record(
      'B cannot update A session_invites via REST',
      !bUpdateInvite.ok || (bUpdateInvite.rows?.length ?? 0) === 0,
      `status=${bUpdateInvite.status}`
    )

    // --- B cannot insert a child row pointing at A's lead ---
    const childInsert = await restRequest(
      'POST',
      '/lead_evidence',
      bWorkspace.jwt,
      { lead_id: aWorkspace.ids.lead, source_url: 'https://attacker.example.com' }
    )
    record(
      'B cannot insert lead_evidence pointing to A lead',
      !childInsert.ok || (childInsert.rows?.length ?? 0) === 0,
      `status=${childInsert.status}`
    )

    // --- B cannot spoof A's owner_id ---
    const spoofInsert = await restRequest(
      'POST',
      '/business_profiles',
      bWorkspace.jwt,
      { owner_id: idA, business_name: 'Spoofed', version: 99 }
    )
    record(
      'B cannot insert business_profile with A owner_id',
      !spoofInsert.ok || (spoofInsert.rows?.length ?? 0) === 0,
      `status=${spoofInsert.status}`
    )

    // --- AAL1 session cannot read A's own rows ---
    const aal1Read = await restRequest(
      'GET',
      `/business_profiles?owner_id=eq.${idA}`,
      jwtA1
    )
    record(
      'A AAL1 session cannot read own rows',
      !aal1Read.ok || (aal1Read.rows?.length ?? 0) === 0,
      `status=${aal1Read.status}`
    )

    // --- Anonymous requests read nothing ---
    const anonRead = await restRequest(
      'GET',
      '/business_profiles?select=*',
      null
    )
    record(
      'Anonymous key reads nothing',
      !anonRead.ok || (anonRead.rows?.length ?? 0) === 0,
      `status=${anonRead.status}`
    )
  } finally {
    if (idA) await admin.auth.admin.deleteUser(idA).catch(() => {})
    if (idB) await admin.auth.admin.deleteUser(idB).catch(() => {})
  }
}

run()
  .catch((err) => {
    record('Script error', false, err instanceof Error ? err.message : String(err))
  })
  .finally(() => {
    console.log('\nScoutSpeak isolation test results')
    console.log('=================================')
    let passed = 0
    let failed = 0
    for (const { name, pass, detail } of results) {
      const status = pass ? 'PASS' : 'FAIL'
      const detailStr = detail ? ` (${detail})` : ''
      console.log(`${status}: ${name}${detailStr}`)
      if (pass) passed += 1
      else failed += 1
    }
    console.log('---------------------------------')
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`)
    process.exit(failed > 0 ? 1 : 0)
  })
