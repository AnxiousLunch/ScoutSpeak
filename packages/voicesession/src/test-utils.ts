import type {
  ModelClient,
  SessionStore,
  StoredMessage,
  StoredSession,
  StoredReview,
} from './types'

export function createFakeStore(initialSession: StoredSession): SessionStore {
  const sessions = new Map<string, StoredSession>([[initialSession.id, initialSession]])
  const messages = new Map<string, StoredMessage[]>([[initialSession.id, []]])
  const reviews = new Map<string, StoredReview>()
  let idCounter = 1

  return {
    async getSession(sessionId: string): Promise<StoredSession | null> {
      return sessions.get(sessionId) ?? null
    },
    async listMessages(sessionId: string): Promise<StoredMessage[]> {
      return [...(messages.get(sessionId) ?? [])].sort(
        (a, b) => a.sequence_number - b.sequence_number
      )
    },
    async insertMessage(
      message: Omit<StoredMessage, 'id' | 'created_at'>
    ): Promise<StoredMessage> {
      const full: StoredMessage = {
        ...message,
        id: `msg-${idCounter++}`,
        created_at: new Date().toISOString(),
      }
      const list = messages.get(message.session_id) ?? []
      list.push(full)
      messages.set(message.session_id, list)
      return full
    },
    async updateSession(
      sessionId: string,
      patch: Partial<Omit<StoredSession, 'id'>>
    ): Promise<StoredSession> {
      const existing = sessions.get(sessionId)
      if (!existing) throw new Error('Session not found')
      const updated = { ...existing, ...patch }
      sessions.set(sessionId, updated)
      return updated
    },
    async upsertReview(
      sessionId: string,
      review: StoredReview
    ): Promise<StoredReview> {
      const full: StoredReview = {
        ...review,
        id: `review-${idCounter++}`,
      }
      reviews.set(sessionId, full)
      return full
    },
  }
}

export function createFakeModel(opts?: {
  textReplies?: string[]
  jsonReplies?: unknown[]
}): ModelClient {
  const textReplies = opts?.textReplies ?? []
  const jsonReplies = opts?.jsonReplies ?? []
  let textIndex = 0
  let jsonIndex = 0

  return {
    async generateText(): Promise<string> {
      const reply = textReplies[textIndex++]
      if (typeof reply !== 'string') {
        throw new Error('No more fake text replies')
      }
      return reply
    },
    async generateJSON<T>(): Promise<T> {
      const reply = jsonReplies[jsonIndex++]
      if (reply === undefined) {
        throw new Error('No more fake JSON replies')
      }
      return reply as T
    },
  }
}
