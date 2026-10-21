import { isIPv4, isIPv6 } from 'net'

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return null
  }
  return parts
}

function expandIPv6(ip: string): string | null {
  if (!isIPv6(ip)) return null
  let full = ip.toLowerCase()
  const double = full.indexOf('::')
  if (double !== -1) {
    const left = full.slice(0, double).split(':').filter(Boolean)
    const right = full.slice(double + 2).split(':').filter(Boolean)
    const missing = 8 - left.length - right.length
    if (missing < 0) return null
    const middle = Array(missing).fill('0')
    full = [...left, ...middle, ...right].join(':')
  }
  const groups = full.split(':')
  if (groups.length !== 8) return null
  return groups.map((g) => g.padStart(4, '0')).join(':')
}

function isBlockedIPv4(ip: string): boolean {
  const parts = parseIPv4(ip)
  if (!parts) return true
  const [a, b, c, d] = parts

  if (a === 0 && b === 0 && c === 0 && d === 0) return true
  if (a === 127) return true
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a >= 224 && a <= 239) return true

  return false
}

function isBlockedIPv6(ip: string): boolean {
  const expanded = expandIPv6(ip)
  if (!expanded) return true
  const first = expanded.slice(0, 4)
  if (first === '0000' && expanded.slice(4, 8) === '0000' && expanded.slice(8, 16) === '00000000' && expanded.slice(16, 31) === '000000000000000' && expanded[31] === '1') {
    return true
  }
  const firstByte = parseInt(first, 16)
  if ((firstByte & 0xfe00) === 0xfc00) return true
  if ((firstByte & 0xffc0) === 0xfe80) return true
  if ((firstByte & 0xff00) === 0xff00) return true
  if ((firstByte & 0xff00) === 0xff00) return true
  return false
}

export function isBlockedAddress(ip: string): boolean {
  const lowered = ip.toLowerCase()

  if (lowered.startsWith('::ffff:')) {
    const v4 = lowered.slice(7)
    return isBlockedIPv4(v4)
  }

  if (isIPv4(lowered)) return isBlockedIPv4(lowered)
  if (isIPv6(lowered)) return isBlockedIPv6(lowered)
  return true
}
