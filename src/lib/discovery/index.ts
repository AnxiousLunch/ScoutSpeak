import type { DiscoveryProvider } from './types'
import { openStreetMapProvider } from './providers/openstreetmap'

export function getDiscoveryProvider(): DiscoveryProvider {
  return openStreetMapProvider
}

export * from './types'
