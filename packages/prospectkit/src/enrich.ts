import type { ModelClient } from './types.js'
import type { EnrichmentResult } from './schema.js'
import type { FitResult } from './fit.js'
import type { PageInput, ProfileInput } from './prompt.js'
import { buildEnrichmentPrompt } from './prompt.js'
import { makeEnrichmentSchema } from './citations.js'
import { computeFit } from './fit.js'
import { researchStatus, type ResearchStatus } from './status.js'

export interface LeadInput {
  company_name?: string | null
  website_url?: string | null
}

export interface EnrichLeadInput {
  model: ModelClient
  profile: ProfileInput
  lead: LeadInput
  pages: PageInput[]
}

export interface EnrichLeadOutput {
  result: EnrichmentResult | null
  fit: FitResult | null
  status: ResearchStatus
}

function numberConstraints(constraints?: string | null): string[] {
  if (!constraints) return []
  return constraints
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => `${index + 1}. ${line}`)
}

export async function enrichLead(input: EnrichLeadInput): Promise<EnrichLeadOutput> {
  const numberedConstraints = numberConstraints(input.profile.constraints)
  const { system, user } = buildEnrichmentPrompt(
    input.profile,
    numberedConstraints,
    input.pages
  )

  const allowedTags = new Set(input.pages.map((page) => page.tag))
  const schema = makeEnrichmentSchema(allowedTags)

  try {
    let result: EnrichmentResult | undefined
    let validationError = ''
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      try {
        result = await input.model.generateJSON<EnrichmentResult>({
          system,
          user: attempt === 0 ? user : `${user}\n\nRepair the previous response to satisfy the schema. Validation errors: ${validationError}`,
          schema,
          maxTokens: 2500,
        })
      } catch (error) {
        validationError = error instanceof Error ? error.message : String(error)
      }
    }
    if (!result) return { result: null, fit: null, status: 'unverified' }

    const fit = computeFit(result.ratings, result.violated_constraints)
    const status = researchStatus({
      okPages: input.pages.length,
      citationsValid: true,
      observedSignalCited: result.observed_signal.evidence.length > 0,
    })

    return { result, fit, status }
  } catch {
    return { result: null, fit: null, status: 'unverified' }
  }
}
