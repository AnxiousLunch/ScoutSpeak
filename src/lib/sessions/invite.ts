import { createHash, randomBytes } from 'node:crypto'

export const INVITE_TTL_MS = 24 * 60 * 60 * 1000

export function createToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function isExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  const time = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt)
  if (Number.isNaN(time)) return true
  return time <= now.getTime()
}
