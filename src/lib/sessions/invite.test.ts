import { describe, it, expect } from 'vitest'
import { createToken, hashToken, isExpired } from './invite'

describe('invite tokens', () => {
  it('creates 32 random bytes as base64url', () => {
    const token = createToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    expect(createToken()).not.toBe(token)
  })

  it('hashes to a stable sha256 hex digest that differs from the token', () => {
    const hash = hashToken('abc')
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(hashToken('abc')).toBe(hash)
    expect(hashToken('abd')).not.toBe(hash)
  })

  it('detects expiry', () => {
    const now = new Date('2025-01-02T00:00:00Z')
    expect(isExpired('2025-01-01T23:59:59Z', now)).toBe(true)
    expect(isExpired('2025-01-02T00:00:00Z', now)).toBe(true)
    expect(isExpired('2025-01-02T00:00:01Z', now)).toBe(false)
    expect(isExpired(new Date('2025-01-03T00:00:00Z'), now)).toBe(false)
    expect(isExpired('not a date', now)).toBe(true)
  })
})
