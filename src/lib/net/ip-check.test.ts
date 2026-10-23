import { describe, expect, it } from 'vitest'
import { isBlockedAddress } from './ip-check'

describe('isBlockedAddress', () => {
  it.each(['::', '::1', '::ffff:127.0.0.1', '2130706433', '0x7f000001'])(
    'blocks local or noncanonical IPv4 address %s',
    (address) => {
      expect(isBlockedAddress(address)).toBe(true)
    }
  )

  it('allows a public IPv4 address', () => {
    expect(isBlockedAddress('8.8.8.8')).toBe(false)
  })
})
