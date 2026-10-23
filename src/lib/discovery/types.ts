export interface DiscoveryRecord {
  providerId: string | null
  name: string
  category: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  websiteUrl: string | null
  phone: string | null
  source: string
  attribution: Record<string, unknown>
}

export interface DiscoverySearchInput {
  keyword: string
  location: string
  limit: number
}

export interface DiscoveryProvider {
  name: string
  attribution: string
  search(input: DiscoverySearchInput): Promise<DiscoveryRecord[]>
}
