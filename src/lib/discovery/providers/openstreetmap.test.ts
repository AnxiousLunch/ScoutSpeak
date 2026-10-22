import { describe, it, expect, vi, beforeEach } from 'vitest'
import { openStreetMapProvider } from './openstreetmap'

vi.stubGlobal('fetch', vi.fn())

const mockedFetch = vi.mocked(fetch)

function nominatimResponse(bbox: [string, string, string, string]) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve([{ place_id: 1, boundingbox: bbox, display_name: 'Karachi, Pakistan', lat: '24.86', lon: '67.0' }]),
  } as Response)
}

function overpassResponse(elements: unknown[]) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ elements }),
  } as Response)
}

describe('openStreetMapProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns normalized records for a supported category', async () => {
    mockedFetch
      .mockResolvedValueOnce(nominatimResponse(['24.7', '25.0', '66.8', '67.2']))
      .mockResolvedValueOnce(overpassResponse([
        { type: 'node', id: 123, lat: 24.86, lon: 67.01, tags: { name: 'Karachi Accounting Ltd', office: 'accountant', website: 'https://example.com' } },
      ]))

    const results = await openStreetMapProvider.search({ keyword: 'accounting', location: 'Karachi, Pakistan', limit: 5 })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      providerId: 'node/123',
      name: 'Karachi Accounting Ltd',
      category: 'Accountant',
      websiteUrl: 'https://example.com',
      source: 'openstreetmap',
    })
    expect(results[0].attribution.osm_type).toBe('node')
  })

  it('returns an empty array for an unsupported keyword', async () => {
    const results = await openStreetMapProvider.search({ keyword: 'xyz-unknown-category-123', location: 'Karachi', limit: 5 })
    expect(results).toEqual([])
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('returns records without invented websites or phones', async () => {
    mockedFetch
      .mockResolvedValueOnce(nominatimResponse(['24.7', '25.0', '66.8', '67.2']))
      .mockResolvedValueOnce(overpassResponse([
        { type: 'way', id: 456, center: { lat: 24.87, lon: 67.02 }, tags: { name: 'No Site Accounting' } },
      ]))

    const results = await openStreetMapProvider.search({ keyword: 'accountant', location: 'Karachi, Pakistan', limit: 5 })

    expect(results[0].websiteUrl).toBeNull()
    expect(results[0].phone).toBeNull()
  })

  it('handles empty Overpass responses', async () => {
    mockedFetch
      .mockResolvedValueOnce(nominatimResponse(['24.7', '25.0', '66.8', '67.2']))
      .mockResolvedValueOnce(overpassResponse([]))

    const results = await openStreetMapProvider.search({ keyword: 'accountant', location: 'Karachi, Pakistan', limit: 5 })
    expect(results).toEqual([])
  })

  it('respects the result limit', async () => {
    mockedFetch
      .mockResolvedValueOnce(nominatimResponse(['24.7', '25.0', '66.8', '67.2']))
      .mockResolvedValueOnce(overpassResponse([
        { type: 'node', id: 1, lat: 24.86, lon: 67.01, tags: { name: 'A' } },
        { type: 'node', id: 2, lat: 24.86, lon: 67.01, tags: { name: 'B' } },
        { type: 'node', id: 3, lat: 24.86, lon: 67.01, tags: { name: 'C' } },
      ]))

    const results = await openStreetMapProvider.search({ keyword: 'accountant', location: 'Karachi, Pakistan', limit: 2 })
    expect(results).toHaveLength(2)
  })

  it('throws on Overpass rate limit', async () => {
    mockedFetch
      .mockResolvedValueOnce(nominatimResponse(['24.7', '25.0', '66.8', '67.2']))
      .mockResolvedValueOnce({ ok: false, status: 429, json: () => Promise.resolve({}) } as Response)

    await expect(openStreetMapProvider.search({ keyword: 'accountant', location: 'Karachi, Pakistan', limit: 5 })).rejects.toThrow('rate limit')
  })

  it('throws on timeout via AbortError', async () => {
    mockedFetch
      .mockResolvedValueOnce(nominatimResponse(['24.7', '25.0', '66.8', '67.2']))
      .mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))

    await expect(openStreetMapProvider.search({ keyword: 'accountant', location: 'Karachi, Pakistan', limit: 5 })).rejects.toThrow('timed out')
  })
})
