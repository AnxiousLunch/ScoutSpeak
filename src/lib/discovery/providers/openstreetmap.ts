import type { DiscoveryProvider, DiscoveryRecord, DiscoverySearchInput } from '../types'
import { FetchBlockedError } from '@/lib/net/errors'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const OVERPASS_URLS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]
const USER_AGENT = 'ScoutSpeak/1.0 (research; contact via app)'
const REQUEST_TIMEOUT_MS = 15000
const NOMINATIM_RATE_MS = 1100

interface NominatimResult {
  place_id: number
  boundingbox: [string, string, string, string]
  display_name: string
  lat: string
  lon: string
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements: OverpassElement[]
}

interface CategoryMapping {
  tags: string[]
  display: string
}

const CATEGORY_MAP: Record<string, CategoryMapping> = {
  accountant: { tags: ['["office"="accountant"]'], display: 'Accountant' },
  accounting: { tags: ['["office"="accountant"]'], display: 'Accountant' },
  restaurant: { tags: ['["amenity"="restaurant"]'], display: 'Restaurant' },
  cafe: { tags: ['["amenity"="cafe"]'], display: 'Cafe' },
  coffee: { tags: ['["amenity"="cafe"]'], display: 'Cafe' },
  hotel: { tags: ['["tourism"="hotel"]'], display: 'Hotel' },
  hospital: { tags: ['["amenity"="hospital"]'], display: 'Hospital' },
  clinic: { tags: ['["amenity"="clinic"]'], display: 'Clinic' },
  school: { tags: ['["amenity"="school"]'], display: 'School' },
  lawyer: { tags: ['["office"="lawyer"]'], display: 'Lawyer' },
  'real estate': { tags: ['["office"="estate_agent"]'], display: 'Real estate agency' },
  dentist: { tags: ['["amenity"="dentist"]'], display: 'Dentist' },
  pharmacy: { tags: ['["amenity"="pharmacy"]'], display: 'Pharmacy' },
  gym: { tags: ['["leisure"="fitness_centre"]'], display: 'Gym / fitness centre' },
  fitness: { tags: ['["leisure"="fitness_centre"]'], display: 'Gym / fitness centre' },
  beauty: { tags: ['["shop"="beauty"]'], display: 'Beauty salon' },
  florist: { tags: ['["shop"="florist"]'], display: 'Florist' },
  bakery: { tags: ['["shop"="bakery"]'], display: 'Bakery' },
  supermarket: { tags: ['["shop"="supermarket"]'], display: 'Supermarket' },
  grocery: { tags: ['["shop"="supermarket"]', '["shop"="convenience"]'], display: 'Grocery store' },
  retail: { tags: ['["shop"]'], display: 'Retail shop' },
  shop: { tags: ['["shop"]'], display: 'Shop' },
  it: { tags: ['["office"="it"]'], display: 'IT office' },
  software: { tags: ['["office"="it"]', '["office"="software"]'], display: 'Software company' },
  marketing: { tags: ['["office"="advertising_agency"]'], display: 'Marketing agency' },
  consulting: { tags: ['["office"="consulting"]'], display: 'Consultancy' },
  construction: { tags: ['["craft"="builder"]', '["office"="construction_company"]'], display: 'Construction' },
  plumber: { tags: ['["craft"="plumber"]'], display: 'Plumber' },
  electrician: { tags: ['["craft"="electrician"]'], display: 'Electrician' },
  photography: { tags: ['["shop"="photo"]', '["office"="photographer"]'], display: 'Photography' },
  design: { tags: ['["office"="design"]'], display: 'Design agency' },
  agency: { tags: ['["office"="advertising_agency"]', '["office"="design"]', '["office"="consulting"]'], display: 'Agency' },
  car: { tags: ['["shop"="car"]', '["shop"="car_repair"]'], display: 'Automotive' },
  salon: { tags: ['["shop"="beauty"]', '["shop"="hairdresser"]'], display: 'Salon' },
  travel: { tags: ['["office"="travel_agent"]'], display: 'Travel agency' },
  insurance: { tags: ['["office"="insurance"]'], display: 'Insurance office' },
  bank: { tags: ['["amenity"="bank"]'], display: 'Bank' },
}

function normalizeKeyword(keyword: string): string | null {
  const lower = keyword.toLowerCase().trim()
  if (CATEGORY_MAP[lower]) return lower
  for (const key of Object.keys(CATEGORY_MAP)) {
    if (lower.includes(key)) return key
  }
  return null
}

function buildOverpassQuery(bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number }, mapping: CategoryMapping, limit: number): string {
  const setClauses = mapping.tags.map((tag) => `nwr${tag}(${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});`)
  return `[out:json][timeout:15];
(
${setClauses.join('\n')}
);
out center ${limit};
`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

class OpenStreetMapProvider implements DiscoveryProvider {
  name = 'openstreetmap'
  attribution = '© OpenStreetMap contributors'

  private nominatimCache = new Map<string, { bbox: NominatimResult['boundingbox']; display: string; at: number }>()
  private lastNominatimAt = 0

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          ...(init?.headers ?? {}),
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
      })
      if (!res.ok) {
        if (res.status === 429) throw new FetchBlockedError('rate_limit', 'Overpass/Nominatim rate limit')
        if (res.status >= 500) throw new FetchBlockedError('server_error', `HTTP ${res.status}`)
        throw new FetchBlockedError('fetch_error', `HTTP ${res.status}`)
      }
      return (await res.json()) as T
    } catch (e) {
      if (e instanceof FetchBlockedError) throw e
      if (e instanceof Error && e.name === 'AbortError') throw new FetchBlockedError('timeout', 'Discovery request timed out')
      throw new FetchBlockedError('fetch_error', e instanceof Error ? e.message : String(e))
    } finally {
      clearTimeout(timeout)
    }
  }

  private async resolveLocation(location: string): Promise<{ bbox: NominatimResult['boundingbox']; display: string }> {
    const cached = this.nominatimCache.get(location)
    if (cached && Date.now() - cached.at < 1000 * 60 * 60) {
      return { bbox: cached.bbox, display: cached.display }
    }

    const sinceLast = Date.now() - this.lastNominatimAt
    if (sinceLast < NOMINATIM_RATE_MS) {
      await sleep(NOMINATIM_RATE_MS - sinceLast)
    }
    this.lastNominatimAt = Date.now()

    const url = `${NOMINATIM_URL}?${new URLSearchParams({ q: location, format: 'json', limit: '1' })}`
    const results = await this.fetchJson<NominatimResult[]>(url)
    if (!results || results.length === 0) {
      throw new FetchBlockedError('fetch_error', `Location not found: ${location}`)
    }

    const result = results[0]
    this.nominatimCache.set(location, { bbox: result.boundingbox, display: result.display_name, at: Date.now() })
    return { bbox: result.boundingbox, display: result.display_name }
  }

  async search(input: DiscoverySearchInput): Promise<DiscoveryRecord[]> {
    const category = normalizeKeyword(input.keyword)
    if (!category) {
      return []
    }

    const mapping = CATEGORY_MAP[category]
    const { bbox } = await this.resolveLocation(input.location)

    const parsedBbox = {
      minLat: Number(bbox[0]) - 0.01,
      maxLat: Number(bbox[1]) + 0.01,
      minLon: Number(bbox[2]) - 0.01,
      maxLon: Number(bbox[3]) + 0.01,
    }

    const query = buildOverpassQuery(parsedBbox, mapping, input.limit)
    const overpass = await this.fetchJson<OverpassResponse>(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    })

    const elements = (overpass.elements ?? []).slice(0, input.limit)
    return elements.map((el) => this.toRecord(el, mapping.display, input.location))
  }

  private toRecord(element: OverpassElement, categoryDisplay: string, queryLocation: string): DiscoveryRecord {
    const tags = element.tags ?? {}
    const name = tags.name?.trim() || `Unnamed ${categoryDisplay}`
    const lat = element.lat ?? element.center?.lat ?? null
    const lon = element.lon ?? element.center?.lon ?? null

    const addressParts = [
      tags['addr:street'],
      tags['addr:housenumber'],
      tags['addr:city'],
      tags['addr:state'],
      tags['addr:postcode'],
      tags['addr:country'],
    ].filter(Boolean)

    const address = addressParts.length > 0 ? addressParts.join(', ') : null
    const website = tags.website ?? tags.contact_website ?? tags['contact:website'] ?? null
    const phone = tags.phone ?? tags.contact_phone ?? tags['contact:phone'] ?? null

    return {
      providerId: `${element.type}/${element.id}`,
      name,
      category: categoryDisplay,
      address,
      latitude: lat,
      longitude: lon,
      websiteUrl: website,
      phone,
      source: this.name,
      attribution: {
        osm_type: element.type,
        osm_id: element.id,
        query_location: queryLocation,
        tags,
      },
    }
  }
}

export const openStreetMapProvider = new OpenStreetMapProvider()
