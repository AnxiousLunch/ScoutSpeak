import { describe, it, expect, vi, beforeEach } from 'vitest'
import { lookup } from 'dns/promises'
import { request } from 'undici'
import { safeFetchPage, FetchBlockedError } from './safe-fetch'

vi.mock('dns/promises', () => ({ lookup: vi.fn() }))
vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>()
  return { ...actual, request: vi.fn() }
})

const mockedLookup = vi.mocked(lookup)
const mockedRequest = vi.mocked(request)

function mockBody(chunks: (string | Buffer)[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) yield chunk
    },
    resume: vi.fn(),
  }
}

function mockResponse(opts: {
  statusCode: number
  headers?: Record<string, string | string[]>
  body?: ReturnType<typeof mockBody>
}) {
  return Promise.resolve({
    statusCode: opts.statusCode,
    headers: opts.headers ?? {},
    body: opts.body ?? mockBody(['<html></html>']),
  } as Awaited<ReturnType<typeof request>>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('safeFetchPage', () => {
  it('fetches a valid public page', async () => {
    mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    mockedRequest.mockReturnValue(
      mockResponse({
        statusCode: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: mockBody(['<html><title>Hello</title></html>']),
      })
    )

    const page = await safeFetchPage('https://example.com/')
    expect(page.status).toBe(200)
    expect(page.contentType).toBe('text/html')
    expect(page.text).toContain('Hello')
  })

  it.each([
    ['127.0.0.1', 'loopback'],
    ['10.0.0.1', 'private 10/8'],
    ['172.16.0.1', 'private 172.16/12'],
    ['192.168.1.1', 'private 192.168/16'],
    ['169.254.1.1', 'link-local'],
    ['100.64.0.1', 'CGNAT'],
    ['0.0.0.0', 'zero'],
    ['224.0.0.1', 'multicast'],
    ['::1', 'IPv6 loopback'],
    ['fc00::1', 'IPv6 unique local'],
    ['fe80::1', 'IPv6 link-local'],
    ['::ffff:192.168.1.1', 'IPv4-mapped private'],
  ])('blocks %s (%s)', async (ip) => {
    mockedLookup.mockResolvedValue([{ address: ip, family: ip.includes(':') ? 6 : 4 }])
    await expect(safeFetchPage('https://example.com/')).rejects.toBeInstanceOf(FetchBlockedError)
  })

  it('blocks redirects that resolve to a private address', async () => {
    mockedLookup.mockImplementation(async (hostname) => {
      if (hostname === 'example.com') return [{ address: '93.184.216.34', family: 4 }]
      return [{ address: '192.168.1.1', family: 4 }]
    })

    mockedRequest.mockReturnValueOnce(
      mockResponse({
        statusCode: 302,
        headers: { location: 'https://internal.example/' },
      })
    )

    await expect(safeFetchPage('https://example.com/')).rejects.toMatchObject({
      code: 'dns_blocked',
    })
  })

  it('blocks non-HTML responses', async () => {
    mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    mockedRequest.mockReturnValue(
      mockResponse({
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    await expect(safeFetchPage('https://example.com/')).rejects.toMatchObject({
      code: 'non_html',
    })
  })

  it('blocks responses larger than 1 MB', async () => {
    mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    mockedRequest.mockReturnValue(
      mockResponse({
        statusCode: 200,
        headers: { 'content-type': 'text/html' },
        body: mockBody([Buffer.alloc(1024 * 1024 + 1, 'a')]),
      })
    )

    await expect(safeFetchPage('https://example.com/')).rejects.toMatchObject({
      code: 'oversize',
    })
  })
})
