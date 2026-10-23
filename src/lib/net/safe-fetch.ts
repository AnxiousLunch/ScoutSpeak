import { lookup as dnsLookup } from 'dns/promises'
import { Agent, request, type Dispatcher } from 'undici'
import { isBlockedAddress } from './ip-check'
import { FetchBlockedError } from './errors'

const MAX_REDIRECTS = 3
const TIMEOUT_MS = 8000
const MAX_BYTES = 1024 * 1024
const USER_AGENT = 'ScoutSpeak/1.0 (+research bot)'

export interface FetchedPage {
  finalUrl: string
  status: number
  contentType: string
  text: string
  truncated: boolean
}

interface ResolvedAddress {
  address: string
  family: 4 | 6
}

async function resolveAllowed(hostname: string): Promise<ResolvedAddress> {
  let records: { address: string; family: number }[]
  try {
    records = await dnsLookup(hostname, { all: true })
  } catch {
    throw new FetchBlockedError('dns_blocked', 'DNS lookup failed')
  }

  if (records.length === 0) {
    throw new FetchBlockedError('dns_blocked', 'No DNS records found')
  }

  const blocked = records.some((record) => isBlockedAddress(record.address))
  if (blocked) {
    throw new FetchBlockedError('dns_blocked', 'A resolved address is blocked')
  }

  const first = records[0]
  return { address: first.address, family: first.family === 6 ? 6 : 4 }
}

function validateUrl(url: string): URL {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new FetchBlockedError('invalid_scheme', 'Invalid URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new FetchBlockedError('invalid_scheme', 'Only http and https are allowed')
  }

  if (parsed.username || parsed.password) {
    throw new FetchBlockedError('userinfo', 'URLs with credentials are not allowed')
  }

  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80
  if (port !== 80 && port !== 443) {
    throw new FetchBlockedError('nonstandard_port', 'Only standard ports 80 and 443 are allowed')
  }

  return parsed
}

function makePinnedAgent(address: string, family: 4 | 6): Agent {
  return new Agent({
    connect: {
      lookup: (_hostname, options, callback) => {
        if ((options as { all?: boolean } | undefined)?.all) {
          ;(callback as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, [{ address, family }])
        } else {
          ;(callback as unknown as (e: null, a: string, f: number) => void)(null, address, family)
        }
      },
    },
  })
}

function getHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

async function readBody(
  body: Dispatcher.ResponseData['body'],
  contentType: string
): Promise<{ text: string; truncated: boolean }> {
  if (!body) {
    return { text: '', truncated: false }
  }

  const chunks: Buffer[] = []
  let total = 0

  for await (const chunk of body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
    total += buffer.length
    if (total > MAX_BYTES) {
      throw new FetchBlockedError('oversize', 'Response body exceeds 1 MB')
    }
    chunks.push(buffer)
  }

  const raw = Buffer.concat(chunks)
  const text = raw.toString(contentType.includes('charset=iso-8859') ? 'latin1' : 'utf-8')
  return { text, truncated: false }
}

export async function safeFetchPage(url: string): Promise<FetchedPage> {
  let currentUrl = validateUrl(url)
  let redirects = 0

  while (true) {
    if (redirects > MAX_REDIRECTS) {
      throw new FetchBlockedError('redirect_limit', 'Too many redirects')
    }

    const hostname = currentUrl.hostname
    const resolved = await resolveAllowed(hostname)
    const agent = makePinnedAgent(resolved.address, resolved.family)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let response: Dispatcher.ResponseData | undefined
    try {
      response = await request(currentUrl.toString(), {
        dispatcher: agent,
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      } as unknown as Dispatcher.RequestOptions)
    } catch (cause) {
      if (controller.signal.aborted) {
        throw new FetchBlockedError('timeout', 'Request timed out')
      }
      throw new FetchBlockedError('fetch_error', cause instanceof Error ? cause.message : String(cause))
    } finally {
      clearTimeout(timeout)
    }

    const status = response.statusCode
    const rawContentType = (getHeader(response.headers['content-type']) ?? '').toLowerCase()

    if (status >= 300 && status < 400) {
      const location = getHeader(response.headers.location)
      if (!location) {
        throw new FetchBlockedError('fetch_error', 'Redirect missing Location header')
      }
      currentUrl = validateUrl(new URL(location, currentUrl).toString())
      redirects += 1
      response.body?.resume?.()
      continue
    }

    if (status >= 400) {
      response.body?.resume?.()
      if (status === 404) {
        throw new FetchBlockedError('not_found', `HTTP ${status}`)
      }
      if (status === 403) {
        throw new FetchBlockedError('blocked', `HTTP ${status}`)
      }
      if (status === 429) {
        throw new FetchBlockedError('rate_limit', `HTTP ${status}`)
      }
      if (status >= 500) {
        throw new FetchBlockedError('server_error', `HTTP ${status}`)
      }
      throw new FetchBlockedError('fetch_error', `HTTP ${status}`)
    }

    const allowedType =
      rawContentType.includes('text/html') || rawContentType.includes('application/xhtml+xml')
    if (!allowedType) {
      response.body?.resume?.()
      throw new FetchBlockedError('non_html', `Unsupported content type: ${rawContentType}`)
    }

    const contentType = rawContentType.split(';')[0].trim() || 'text/html'

    try {
      const { text, truncated } = await readBody(response.body, rawContentType)
      return {
        finalUrl: currentUrl.toString(),
        status,
        contentType,
        text,
        truncated,
      }
    } catch (e) {
      if (e instanceof FetchBlockedError) throw e
      throw new FetchBlockedError('fetch_error', e instanceof Error ? e.message : String(e))
    }
  }
}