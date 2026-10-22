import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { getModelClient } from '@/lib/ai'
import { AiError } from '@/lib/ai/errors'
import { transition, type SessionStatus } from 'voicesession'
import { getStrategy } from '@/lib/strategies'
import { buildSystemPrompt, pickOpeningQuestion, type SessionBrief } from '@/lib/sessions/prompt'

export const runtime = 'nodejs'

const InputMethodSchema = z.enum(['voice_browser', 'voice_hosted', 'typed'])

const RequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('start'),
    inputMethod: InputMethodSchema.optional().default('typed'),
  }),
  z.object({ action: z.literal('end') }),
  z.object({
    action: z.literal('turn'),
    text: z.string().trim().min(1).max(500),
    inputMethod: InputMethodSchema.optional().default('typed'),
  }),
])

function aiHttpStatus(error: AiError): number {
  switch (error.code) {
    case 'rate_limit':
      return 429
    case 'timeout':
      return 504
    case 'config':
      return 503
    default:
      return 502
  }
}

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
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
    return NextResponse.json({ message: parsed.error.errors[0]?.message || 'Invalid conversation request.' }, { status: 400 })
  }

  const { data: session, error: sessionError } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('id', params.sessionId)
    .eq('owner_id', user.id)
    .single()
  if (sessionError || !session) {
    return NextResponse.json({ message: 'This session was not found.' }, { status: 404 })
  }

  if (!session.participant_consent_at) {
    return NextResponse.json({ error: 'consent_required' }, { status: 409 })
  }

  const strategy = getStrategy(session.strategy_key ?? '')
  const currentStatus = session.session_status as SessionStatus

  if (parsed.data.action === 'end') {
    const { data: savedMessages } = await supabase
      .from('conversation_messages')
      .select('speaker_role')
      .eq('session_id', session.id)
      .eq('owner_id', user.id)
    const humanTurns = (savedMessages ?? []).filter((message) => message.speaker_role === 'human').length
    const hasConsent = Boolean(session.participant_consent_at)
    const completion = transition(currentStatus, 'completed', { humanTurns, consent: hasConsent })
    const cancellation = completion.error ? transition(currentStatus, 'cancelled') : null
    if (completion.error && cancellation?.error) {
      return NextResponse.json({ message: completion.error }, { status: 409 })
    }
    const targetStatus = completion.error ? 'cancelled' : 'completed'
    const { error } = await supabase
      .from('conversation_sessions')
      .update({ session_status: targetStatus, ended_at: new Date().toISOString() })
      .eq('id', session.id)
      .eq('owner_id', user.id)
    if (error) {
      return NextResponse.json({ message: 'Could not save the end of this session. Try again.' }, { status: 500 })
    }
    return NextResponse.json({ ended: true, status: targetStatus })
  }

  if (parsed.data.action === 'start') {
    let startFrom = currentStatus
    if (currentStatus === 'created') {
      const waiting = transition(currentStatus, 'waiting_for_participant')
      if (waiting.error) return NextResponse.json({ message: waiting.error }, { status: 409 })
      const { error } = await supabase
        .from('conversation_sessions')
        .update({ session_status: waiting.status })
        .eq('id', session.id)
        .eq('owner_id', user.id)
      if (error) return NextResponse.json({ message: 'Could not prepare the session. Please retry.' }, { status: 500 })
      startFrom = waiting.status
    }
    if (startFrom !== 'waiting_for_participant' && startFrom !== 'active') {
      return NextResponse.json({ message: `Cannot start a session in ${startFrom} state.` }, { status: 409 })
    }

    const { data: existingMessages } = await supabase
      .from('conversation_messages')
      .select('sequence_number, speaker_role, message_text')
      .eq('session_id', session.id)
      .eq('owner_id', user.id)
      .order('sequence_number', { ascending: true })

    let opening = existingMessages?.find((m) => m.sequence_number === 1 && m.speaker_role === 'agent')?.message_text
    if (!opening) {
      if (session.business_profile_version == null) {
        return NextResponse.json({ message: 'The business profile version for this session is missing.' }, { status: 409 })
      }
      const [{ data: lead }, { data: profile }, { data: evidence }] = await Promise.all([
        supabase.from('leads').select('company_name').eq('id', session.lead_id).eq('owner_id', user.id).single(),
        supabase.from('business_profiles').select('business_name, services').eq('owner_id', user.id).eq('version', session.business_profile_version).single(),
        supabase.from('lead_evidence').select('id').eq('lead_id', session.lead_id).eq('owner_id', user.id),
      ])
      if (!lead || !profile) {
        return NextResponse.json({ message: 'The lead or business profile for this session is missing.' }, { status: 409 })
      }
      const brief = parseBrief(session.brief)
      const openingQuestion = pickOpeningQuestion(brief, (evidence ?? []).length > 0)
      const disclosure = `Hi, I’m an AI sales representative from ${profile.business_name || 'your business'}. This is a ${session.session_purpose === 'rehearsal' ? 'rehearsal' : 'conversation'} with ${lead.company_name}. I’ll use only the offer details and lead evidence available in this workspace.`
      opening = `${disclosure} ${openingQuestion}`
      const { error: insertError } = await supabase
        .from('conversation_messages')
        .insert({ session_id: session.id, owner_id: user.id, sequence_number: 1, speaker_role: 'agent', message_text: opening })
      if (insertError) {
        return NextResponse.json({ message: 'Could not start the session. Please try again.' }, { status: 500 })
      }
    }

    if (startFrom === 'waiting_for_participant') {
      const active = transition(startFrom, 'active')
      if (active.error) return NextResponse.json({ message: active.error }, { status: 409 })
      const { error } = await supabase
        .from('conversation_sessions')
        .update({
          session_status: active.status,
          started_at: session.started_at ?? new Date().toISOString(),
          input_method: parsed.data.inputMethod ?? 'typed',
        })
        .eq('id', session.id)
        .eq('owner_id', user.id)
      if (error) {
        return NextResponse.json({ message: 'The opening was saved, but the session could not be started. Try again.' }, { status: 500 })
      }
    }
    return NextResponse.json({ message: { sequence_number: 1, speaker_role: 'agent', message_text: opening } })
  }

  if (session.session_status !== 'active') {
    return NextResponse.json({ message: 'Start this session before sending a message.' }, { status: 409 })
  }

  const { text, inputMethod } = parsed.data

  const { data: existingMessages, error: messageReadError } = await supabase
    .from('conversation_messages')
    .select('sequence_number, speaker_role, message_text')
    .eq('session_id', session.id)
    .eq('owner_id', user.id)
    .order('sequence_number', { ascending: true })
  if (messageReadError) {
    return NextResponse.json({ message: 'Could not load the saved conversation. Refresh and try again.' }, { status: 500 })
  }
  const messages = existingMessages ?? []

  const last = messages[messages.length - 1]
  const retryingSavedHumanTurn = last?.speaker_role === 'human' && last.message_text === text
  if (!retryingSavedHumanTurn) {
    const nextSequence = Math.max(0, ...messages.map((m) => m.sequence_number)) + 1
    const { error } = await supabase
      .from('conversation_messages')
      .insert({ session_id: session.id, owner_id: user.id, sequence_number: nextSequence, speaker_role: 'human', message_text: text })
    if (error) {
      return NextResponse.json({ message: 'Your message could not be saved. Please retry.' }, { status: 500 })
    }
    messages.push({ sequence_number: nextSequence, speaker_role: 'human', message_text: text })
  }

  const humanTurnCount = messages.filter((m) => m.speaker_role === 'human').length
  const maxTurns = strategy?.max_turns ?? 10
  const stopPhrases = ['stop', 'end this', 'hang up', 'not interested', 'do not call', "don't call", 'leave me alone', 'goodbye']
  const lowerText = text.toLowerCase()
  const shouldEnd = humanTurnCount >= maxTurns || stopPhrases.some((phrase) => lowerText.includes(phrase))

  if (session.business_profile_version == null) {
    return NextResponse.json({ message: 'The business profile version for this session is missing. Your message is saved.' }, { status: 409 })
  }

  const [{ data: lead }, { data: profile }, { data: campaign }, { data: evidence }] = await Promise.all([
    supabase.from('leads').select('company_name, website_url, company_summary, observed_signal, inferred_need, personalization_hook, research_status').eq('id', session.lead_id).eq('owner_id', user.id).single(),
    supabase.from('business_profiles').select('business_name, services, value_proposition, constraints, version').eq('owner_id', user.id).eq('version', session.business_profile_version).single(),
    supabase.from('campaigns').select('name, objective').eq('id', session.campaign_id).eq('owner_id', user.id).single(),
    supabase.from('lead_evidence').select('source_url, page_title, excerpt').eq('lead_id', session.lead_id).eq('owner_id', user.id).limit(6),
  ])
  if (!lead || !profile || !campaign) {
    return NextResponse.json({ message: 'Session context could not be loaded. Your message is saved; retry after refreshing.' }, { status: 409 })
  }

  let runningSummary = session.running_summary ?? ''
  if (messages.length > 6) {
    const history = messages.slice(0, -6)
      .map((message) => `${message.speaker_role === 'agent' ? 'AI representative' : 'Prospect'}: ${message.message_text || ''}`)
      .join('\n')
    try {
      const updatedSummary = (await getModelClient().generateText({
        system: 'Summarize the sales conversation accurately in at most 80 words. Preserve objections and agreed next steps. Do not invent details.',
        user: `Existing summary:\n${runningSummary || '(none)'}\n\nMessages to summarize:\n${history}`,
        maxTokens: 120,
      })).trim()
      if (updatedSummary) {
        const { error: summaryError } = await supabase
          .from('conversation_sessions')
          .update({ running_summary: updatedSummary })
          .eq('id', session.id)
          .eq('owner_id', user.id)
        if (summaryError) {
          return NextResponse.json({ message: 'Your message is saved, but the conversation summary could not be saved. Retry this turn.' }, { status: 500 })
        }
        runningSummary = updatedSummary
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Conversation summary failed.'
      return NextResponse.json({ message: `Your message is saved. ${message}`, saved: true }, { status: 502 })
    }
  }

  const brief = parseBrief(session.brief)
  const evidenceContext = (evidence ?? []).filter((item) => item.excerpt).map((item) => `Source: ${item.page_title || item.source_url || 'public page'}\nExcerpt: ${item.excerpt}`).join('\n\n') || 'No inspected page evidence is stored for this lead yet.'
  const system = buildSystemPrompt({
    purpose: session.session_purpose as 'rehearsal' | 'prospect_conversation',
    services: profile.services,
    strategy,
    brief,
    runningSummary,
    objectionProfile: session.objection_profile,
  })
  const transcript = messages.slice(-6).map((m) => `${m.speaker_role === 'agent' ? 'AI representative' : 'Prospect'}: ${m.message_text || ''}`).join('\n')
  const prompt = `BUSINESS PROFILE (approved offer)\nName: ${profile.business_name || 'Not provided'}\nServices: ${profile.services || 'Not provided'}\nValue proposition: ${profile.value_proposition || 'Not provided'}\nConstraints: ${profile.constraints || 'None provided'}\n\nCAMPAIGN\nName: ${campaign.name}\nObjective: ${campaign.objective || 'Understand the prospect and determine a useful next step.'}\n\nLEAD RECORD\nCompany name: ${lead.company_name}\nWebsite supplied by user: ${lead.website_url || 'None'}\nResearch status: ${lead.research_status}\nSummary: ${lead.company_summary || 'Unknown'}\nObserved signal: ${lead.observed_signal || 'Unknown'}\nPossible need (inference): ${lead.inferred_need || 'Unknown'}\nPersonalization hook: ${lead.personalization_hook || 'None'}\n\nSTORED PUBLIC PAGE EVIDENCE\n${evidenceContext}\n\nRUNNING SUMMARY\n${runningSummary || '(none)'}\n\nRECENT CONVERSATION\n${transcript}\n\nRespond to the prospect’s latest message. Do not repeat the opening. At most 2 sentences, under 45 words.`

  try {
    const reply = (await getModelClient().generateText({ system, user: prompt, maxTokens: 220 })).trim()
    if (!reply) throw new Error('The AI returned an empty response. Retry this turn.')
    const nextSequence = Math.max(0, ...messages.map((m) => m.sequence_number)) + 1
    const { error } = await supabase
      .from('conversation_messages')
      .insert({ session_id: session.id, owner_id: user.id, sequence_number: nextSequence, speaker_role: 'agent', message_text: reply })
    if (error) {
      return NextResponse.json({ message: 'The reply was generated but could not be saved. Retry this turn.' }, { status: 500 })
    }

    const { error: inputMethodError } = await supabase
      .from('conversation_sessions')
      .update({ input_method: inputMethod })
      .eq('id', session.id)
      .eq('owner_id', user.id)
    if (inputMethodError) {
      return NextResponse.json({ message: 'The turn was saved but the input method could not be recorded.', saved: true }, { status: 500 })
    }

    let endedStatus: SessionStatus | null = null
    if (shouldEnd) {
      const hasConsent = Boolean(session.participant_consent_at)
      const completion = transition(currentStatus, 'completed', { humanTurns: humanTurnCount, consent: hasConsent })
      const cancellation = completion.error ? transition(currentStatus, 'cancelled') : null
      if (completion.error && cancellation?.error) {
        return NextResponse.json({ message: completion.error, saved: true }, { status: 409 })
      }
      endedStatus = completion.error ? 'cancelled' : 'completed'
      const { error: statusError } = await supabase
        .from('conversation_sessions')
        .update({ session_status: endedStatus, ended_at: new Date().toISOString() })
        .eq('id', session.id)
        .eq('owner_id', user.id)
      if (statusError) {
        return NextResponse.json({ message: 'The turn was saved but the session status could not be updated.', saved: true }, { status: 500 })
      }
    }

    return NextResponse.json({ message: { sequence_number: nextSequence, speaker_role: 'agent', message_text: reply }, ended: shouldEnd, status: endedStatus ?? 'active' })
  } catch (cause) {
    const message = cause instanceof AiError ? cause.message : cause instanceof Error ? cause.message : 'The AI could not reply. Retry this turn.'
    const status = cause instanceof AiError ? aiHttpStatus(cause) : 502
    return NextResponse.json({ message, saved: true }, { status })
  }
}

function parseBrief(brief: unknown): SessionBrief | null {
  if (typeof brief !== 'object' || brief === null) return null
  const candidate = brief as Record<string, unknown>
  if (
    typeof candidate.goal === 'string' &&
    Array.isArray(candidate.priority_questions) &&
    candidate.priority_questions.every((q) => typeof q === 'string') &&
    Array.isArray(candidate.end_conditions) &&
    candidate.end_conditions.every((c) => typeof c === 'string') &&
    Array.isArray(candidate.permitted_claims)
  ) {
    return candidate as SessionBrief
  }
  return null
}
