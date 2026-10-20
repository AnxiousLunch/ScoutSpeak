import type { SessionStore, StoredReview } from './types.js'

export interface SaveReviewInput {
  store: SessionStore
  sessionId: string
  purpose: string
  review: Omit<StoredReview, 'session_id'>
}

export async function saveReview(
  input: SaveReviewInput
): Promise<StoredReview> {
  const session = await input.store.getSession(input.sessionId)
  if (!session) {
    throw new Error('Session not found')
  }
  if (session.session_purpose !== input.purpose) {
    throw new Error(
      `Purpose mismatch: session purpose is ${session.session_purpose}, review purpose is ${input.purpose}`
    )
  }

  return input.store.upsertReview(input.sessionId, {
    ...input.review,
    session_id: input.sessionId,
  })
}
