import { buildEnrichmentPrompt } from './prompt.js';
import { makeEnrichmentSchema } from './citations.js';
import { computeFit } from './fit.js';
import { researchStatus } from './status.js';

function numberConstraints(constraints) {
  if (!constraints) return [];
  return constraints
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => `${index + 1}. ${line}`);
}

export async function enrichLead(input) {
  if (input.pages.length === 0) {
    return {
      result: null,
      fit: null,
      status: 'unverified',
      error: 'No usable public pages were available to support lead enrichment.',
    };
  }

  const numberedConstraints = numberConstraints(input.profile.constraints);
  const { system, user } = buildEnrichmentPrompt(
    input.profile,
    numberedConstraints,
    input.pages
  );

  const allowedTags = new Set(input.pages.map((page) => page.tag));
  const schema = makeEnrichmentSchema(allowedTags);

  try {
    const result = await input.model.generateJSON({
      system,
      user,
      schema,
      maxTokens: 2500,
    });

    const fit = computeFit(result.ratings, result.violated_constraints);
    const status = researchStatus({
      okPages: input.pages.length,
      citationsValid: true,
      observedSignalCited: result.observed_signal.evidence.length > 0,
    });

    return { result, fit, status };
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      ['rate_limit', 'timeout', 'provider_error', 'config'].includes(String(error.code))
    ) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    return { result: null, fit: null, status: 'unverified', error: message };
  }
}
