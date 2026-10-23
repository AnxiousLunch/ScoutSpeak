import { transition, type SessionStatus } from 'voicesession'
import { getModelClient } from '@/lib/ai'
import { AiError } from '@/lib/ai/errors'
import { getStrategy } from '@/lib/strategies'
import { buildSystemPrompt } from '@/lib/sessions/prompt'
import { aiHttpStatus, fail, parseBrief, type DbClient, type Fail } from '@/lib/sessions/session-ops'

export type InputMethod = 'voice_browser' | 'voice_hosted' | 'typed'

export interface RunTurnInput {
  client: DbClient
  sessionId: string
  text: string
  inputMethod: InputMethod
}

export interface RunTurnOk {
  ok: true
  message: { sequence_number: number; speaker_role: 'agent'; message_text: string }
  ended: boolean
  status: SessionStatus
}

const STOP_PHRASES = ['stop', 'end this', 'hang up', 'not interested', 'do not call', "don't call", 'leave me alone', 'goodbye']

export async function runTurn({ client, sessionId, text, inputMethod }: RunTurnInput): Promise<RunTurnOk | Fail> {
  const { data: session, error: sessionError } = await client
    .from('conversation_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()
  if (sessionError || !session) return fail(404, 'This session was not found.')
  const ownerId = session.owner_id

  if (!session.participant_consent_at) return fail(409, 'Consent is required.', { error: 'consent_required' })
  if (session.session_status !== 'active') return fail(409, 'Start this session before sending a message.')
  if (session.business_profile_version == null) {
    return fail(409, 'The business profile version for this session is missing.')
  }

  const strategy = getStrategy(session.strategy_key ?? '')
  const currentStatus = session.session_status as SessionStatus

  const { data: existingMessages, error: messageReadError } = await client
    .from('conversation_messages')
    .select('sequence_number, speaker_role, message_text')
    .eq('session_id', session.id)
    .order('sequence_number', { ascending: true })
  if (messageReadError) return fail(500, 'Could not load the saved conversation. Refresh and try again.')
  const messages = existingMessages ?? []

  const last = messages[messages.length - 1]
  const retryingSavedHumanTurn = last?.speaker_role === 'human' && last.message_text === text
  if (!retryingSavedHumanTurn) {
    const nextSequence = Math.max(0, ...messages.map((m) => m.sequence_number)) + 1
    const { error } = await client
      .from('conversation_messages')
      .insert({ session_id: session.id, owner_id: ownerId, sequence_number: nextSequence, speaker_role: 'human', message_text: text })
    if (error) return fail(500, 'Your message could not be saved. Please retry.')
    messages.push({ sequence_number: nextSequence, speaker_role: 'human', message_text: text })
  }

  const humanTurnCount = messages.filter((m) => m.speaker_role === 'human').length
  const maxTurns = strategy?.max_turns ?? 10
  const lowerText = text.toLowerCase()
  const shouldEnd = humanTurnCount >= maxTurns || STOP_PHRASES.some((phrase) => lowerText.includes(phrase))

  const [{ data: lead }, { data: profile }, { data: campaign }, { data: evidence }] = await Promise.all([
    client.from('leads').select('company_name, website_url, company_summary, observed_signal, inferred_need, personalization_hook, research_status').eq('id', session.lead_id).eq('owner_id', ownerId).single(),
    client.from('business_profiles').select('business_name, services, value_proposition, constraints, version').eq('owner_id', ownerId).eq('version', session.business_profile_version).single(),
    client.from('campaigns').select('name, objective').eq('id', session.campaign_id).eq('owner_id', ownerId).single(),
    client.from('lead_evidence').select('source_url, page_title, excerpt').eq('lead_id', session.lead_id).eq('owner_id', ownerId).limit(6),
  ])
  if (!lead || !profile || !campaign) {
    return fail(409, 'Session context could not be loaded. Your message is saved; retry after refreshing.')
  }

  let runningSummary = session.running_summary ?? ''
  if (messages.length > 6) {
    const history = messages
      .slice(0, -6)
      .map((m) => `${m.speaker_role === 'agent' ? 'AI representative' : 'Prospect'}: ${m.message_text || ''}`)
      .join('\n')
    try {
      const updated = (await getModelClient().generateText({
        system: 'Summarize the sales conversation accurately in at most 80 words. Preserve objections and agreed next steps. Do not invent details.',
        user: `Existing summary:\n${runningSummary || '(none)'}\n\nMessages to summarize:\n${history}`,
        maxTokens: 120,
      })).trim()
      if (updated) {
        const { error: summaryError } = await client
          .from('conversation_sessions')
          .update({ running_summary: updated })
          .eq('id', session.id)
        if (summaryError) return fail(500, 'Your message is saved, but the conversation summary could not be saved. Retry this turn.')
        runningSummary = updated
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Conversation summary failed.'
      return fail(502, `Your message is saved. ${message}`, { saved: true })
    }
  }

  const brief = parseBrief(session.brief)
  const evidenceContext =
    (evidence ?? [])
      .filter((item) => item.excerpt)
      .map((item) => `Source: ${item.page_title || item.source_url || 'public page'}\nExcerpt: ${item.excerpt}`)
      .join('\n\n') || 'No inspected page evidence is stored for this lead yet.'
  const system = buildSystemPrompt({
    purpose: session.session_purpose as 'rehearsal' | 'prospect_conversation',
    services: profile.services,
    strategy,
    brief,
    runningSummary,
    objectionProfile: session.objection_profile,
  })
  const transcript = messages
    .slice(-6)
    .map((m) => `${m.speaker_role === 'agent' ? 'AI representative' : 'Prospect'}: ${m.message_text || ''}`)
    .join('\n')
  const prompt = `BUSINESS PROFILE (approved offer)\nName: ${profile.business_name || 'Not provided'}\nServices: ${profile.services || 'Not provided'}\nValue proposition: ${profile.value_proposition || 'Not provided'}\nConstraints: ${profile.constraints || 'None provided'}\n\nCAMPAIGN\nName: ${campaign.name}\nObjective: ${campaign.objective || 'Understand the prospect and determine a useful next step.'}\n\nLEAD RECORD\nCompany name: ${lead.company_name}\nWebsite supplied by user: ${lead.website_url || 'None'}\nResearch status: ${lead.research_status}\nSummary: ${lead.company_summary || 'Unknown'}\nObserved signal: ${lead.observed_signal || 'Unknown'}\nPossible need (inference): ${lead.inferred_need || 'Unknown'}\nPersonalization hook: ${lead.personalization_hook || 'None'}\n\nSTORED PUBLIC PAGE EVIDENCE\n${evidenceContext}\n\nRUNNING SUMMARY\n${runningSummary || '(none)'}\n\nRECENT CONVERSATION\n${transcript}\n\nRespond to the prospect’s latest message. Do not repeat the opening. At most 2 sentences, under 45 words.`

  try {
    const reply = (await getModelClient().generateText({ system, user: prompt, maxTokens: 220 })).trim()
    if (!reply) throw new Error('The AI returned an empty response. Retry this turn.')
    const nextSequence = Math.max(0, ...messages.map((m) => m.sequence_number)) + 1
    const { error } = await client
      .from('conversation_messages')
      .insert({ session_id: session.id, owner_id: ownerId, sequence_number: nextSequence, speaker_role: 'agent', message_text: reply })
    if (error) return fail(500, 'The reply was generated but could not be saved. Retry this turn.')

    const { error: inputMethodError } = await client
      .from('conversation_sessions')
      .update({ input_method: inputMethod })
      .eq('id', session.id)
    if (inputMethodError) return fail(500, 'The turn was saved but the input method could not be recorded.', { saved: true })

    let endedStatus: SessionStatus | null = null
    if (shouldEnd) {
      const completion = transition(currentStatus, 'completed', { humanTurns: humanTurnCount, consent: Boolean(session.participant_consent_at) })
      const cancellation = completion.error ? transition(currentStatus, 'cancelled') : null
      if (completion.error && cancellation?.error) return fail(409, completion.error, { saved: true })
      endedStatus = completion.error ? 'cancelled' : 'completed'
      const { error: statusError } = await client
        .from('conversation_sessions')
        .update({ session_status: endedStatus, ended_at: new Date().toISOString(), end_reason: 'limit_or_stop_phrase' })
        .eq('id', session.id)
      if (statusError) return fail(500, 'The turn was saved but the session status could not be updated.', { saved: true })
    }

    return {
      ok: true,
      message: { sequence_number: nextSequence, speaker_role: 'agent', message_text: reply },
      ended: shouldEnd,
      status: endedStatus ?? 'active',
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'The AI could not reply. Retry this turn.'
    const status = cause instanceof AiError ? aiHttpStatus(cause) : 502
    return fail(status, message, { saved: true })
  }
}
