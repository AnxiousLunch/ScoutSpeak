import type {
  ModelClient,
  NextTurnInput,
  NextTurnOutput,
  OpeningTurnInput,
  OpeningTurnOutput,
  StoredMessage,
  StoredSession,
  StrategyConfig,
  SystemPromptInput,
} from './types'
import { buildMessageWindow, maybeUpdateSummary } from './summary'

const DEFAULT_MAX_TOKENS = 120
const STOP_PHRASES = [
  'stop',
  'end this',
  'hang up',
  'not interested',
  'do not call',
  "don't call",
  'leave me alone',
  'goodbye',
]

export function buildSystemPrompt(input: SystemPromptInput): string {
  const parts: string[] = [
    'You are an AI sales assistant. Identify yourself as an AI on the first turn.',
    'Keep replies to 1-2 short sentences unless the strategy says otherwise.',
    'Only state facts about the provider that come from permitted claims.',
    'Only state facts about the prospect that are backed by evidence or by what the counterpart said.',
    'Do not invent prices, case studies, contacts, or results.',
  ]

  if (input.purpose) {
    parts.push(`Session purpose: ${input.purpose}.`)
  }
  if (input.brief) {
    parts.push('BRIEF:', input.brief)
  }
  if (input.strategy?.goal) {
    parts.push(`Goal: ${input.strategy.goal}`)
  }
  if (input.strategy?.tone) {
    parts.push(`Tone: ${input.strategy.tone}`)
  }
  if (input.strategy?.behaviours && input.strategy.behaviours.length > 0) {
    parts.push('Behaviours:')
    input.strategy.behaviours.forEach((behaviour) => parts.push(`- ${behaviour}`))
  }
  if (input.objectionProfile) {
    parts.push('Likely objections:', input.objectionProfile)
  }
  if (input.runningSummary) {
    parts.push('Running summary:', input.runningSummary)
  }

  return parts.join('\n')
}

function nextSequence(messages: StoredMessage[]): number {
  return messages.length === 0 ? 1 : Math.max(...messages.map((message) => message.sequence_number)) + 1
}

function humanTurnCount(messages: StoredMessage[]): number {
  return messages.filter((message) => message.speaker_role === 'human').length
}

function detectEndReason(
  session: StoredSession,
  messages: StoredMessage[]
): string | undefined {
  const humanCount = humanTurnCount(messages)
  const lastHuman = messages.findLast((message) => message.speaker_role === 'human')
  const maxTurns = session.max_turns ?? 6

  if (lastHuman) {
    const lower = lastHuman.message_text?.toLowerCase() ?? ''
    if (STOP_PHRASES.some((phrase) => lower.includes(phrase))) {
      return 'counterpart_declined'
    }
  }

  if (humanCount >= maxTurns) {
    return 'max_turns'
  }

  return undefined
}

export async function openingTurn(
  input: OpeningTurnInput
): Promise<OpeningTurnOutput> {
  const messages = await input.store.listMessages(input.sessionId)
  const existingOpening = messages.find((message) => message.sequence_number === 1 && message.speaker_role === 'agent')
  if (existingOpening) {
    return { agentText: existingOpening.message_text ?? '', message: existingOpening }
  }

  const fixedIntro = `Hi, I'm an AI sales assistant for ${input.businessName}.`
  const agentText = `${fixedIntro} ${input.opener}`.trim()
  const message = await input.store.insertMessage({
    session_id: input.sessionId,
    sequence_number: 1,
    speaker_role: 'agent',
    message_text: agentText,
  })

  return { agentText, message }
}

export async function nextTurn(input: NextTurnInput): Promise<NextTurnOutput> {
  const [session, messages] = await Promise.all([
    input.store.getSession(input.sessionId),
    input.store.listMessages(input.sessionId),
  ])
  if (!session) {
    throw new Error('Session not found')
  }
  if (session.session_status !== 'active') {
    throw new Error(`Session is ${session.session_status}`)
  }

  const lastMessage = messages[messages.length - 1]
  const retrying =
    lastMessage?.speaker_role === 'human' && lastMessage.message_text === input.humanText

  let humanMessage: StoredMessage
  if (retrying) {
    humanMessage = lastMessage
  } else {
    humanMessage = await input.store.insertMessage({
      session_id: input.sessionId,
      sequence_number: nextSequence(messages),
      speaker_role: 'human',
      message_text: input.humanText,
      input_method: input.inputMethod,
    })
    messages.push(humanMessage)
  }

  try {
    await maybeUpdateSummary({
      store: input.store,
      model: input.model,
      sessionId: input.sessionId,
    })

    const refreshedMessages = await input.store.listMessages(input.sessionId)
    const refreshedSession = await input.store.getSession(input.sessionId)
    if (!refreshedSession) {
      throw new Error('Session not found')
    }
    const system = buildSystemPrompt({
      brief: refreshedSession.brief ? JSON.stringify(refreshedSession.brief) : undefined,
      strategy: strategyFromSession(refreshedSession),
      purpose: refreshedSession.session_purpose,
      objectionProfile: refreshedSession.objection_profile,
      runningSummary: refreshedSession.running_summary,
    })
    const window = buildMessageWindow(refreshedMessages, refreshedSession?.running_summary)

    const reply = await input.model.generateText({
      system,
      user: `${window}\n\nProspect: ${input.humanText}\n\nAI:`,
      maxTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
    })

    const agentMessage = await input.store.insertMessage({
      session_id: input.sessionId,
      sequence_number: nextSequence(refreshedMessages),
      speaker_role: 'agent',
      message_text: reply.trim(),
    })

    const updatedMessages = [...refreshedMessages, agentMessage]
    const endReason = detectEndReason(refreshedSession, updatedMessages)

    return {
      agentText: agentMessage.message_text ?? '',
      ended: !!endReason,
      endReason,
    }
  } catch (error) {
    // Keep the saved human message so the caller can retry without duplicating the turn.
    const message = error instanceof Error ? error.message : String(error)
    return { agentText: '', ended: false, error: message }
  }
}

function strategyFromSession(session: StoredSession | null): StrategyConfig | null {
  if (!session) return null
  return {
    key: session.strategy_key ?? 'default',
    version: session.strategy_version ?? 1,
    goal: session.objective ?? undefined,
  }
}
