export type { ModelClient, GenerateJSONOpts, GenerateTextOpts } from './types'
export {
  enrichmentResultSchema,
  ratingsSchema,
  evidenceItemSchema,
  inferredNeedSchema,
  type EnrichmentResult,
  type Ratings,
} from './schema'
export { buildEnrichmentPrompt, type ProfileInput, type PageInput } from './prompt'
export { makeEnrichmentSchema } from './citations'
export { computeFit, type FitWeights, type FitResult } from './fit'
export { researchStatus, type ResearchStatus, type ResearchStatusInput } from './status'
export { enrichLead, type LeadInput, type EnrichLeadInput, type EnrichLeadOutput } from './enrich'
