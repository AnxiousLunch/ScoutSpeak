import {
  enrichLead,
  type EnrichmentResult,
  type ModelClient,
  type GenerateJSONOpts,
} from 'prospectkit'

const baseResult: EnrichmentResult = {
  summary: { text: 'Acme builds cloud accounting tools.', evidence: ['E1'] },
  observed_signal: { text: 'They mention scaling support.', evidence: ['E1'] },
  inferred_need: { text: 'They may need onboarding help.', is_inference: true, evidence: ['E1'] },
  opener: 'What prompted your recent support expansion?',
  missing_fields: ['pricing'],
  violated_constraints: [],
  ratings: {
    offer_match: 4,
    evidence_strength: 4,
    constraint_fit: 5,
    stated_need: 3,
  },
  rating_reasons: { offer_match: 'Services align well.' },
}

function fakeModel(values: EnrichmentResult[]): ModelClient {
  let call = 0
  return {
    async generateJSON<T>({ schema }: GenerateJSONOpts<T>) {
      const next = values[call++] ?? values[values.length - 1]
      const parsed = schema.safeParse(next)
      if (!parsed.success) throw new Error(parsed.error.message)
      return parsed.data as T
    },
    async generateText() {
      return ''
    },
  }
}

async function main() {
  const out = await enrichLead({
    model: fakeModel([baseResult]),
    profile: {
      business_name: 'TestCo',
      services: 'AI onboarding',
      value_proposition: 'Faster onboarding',
      target_industry: 'SaaS',
      target_geography: 'North America',
      constraints: 'Must be in North America\nMust mention cloud',
    },
    lead: { company_name: 'Acme', website_url: 'https://acme.example' },
    pages: [
      {
        tag: 'E1',
        url: 'https://acme.example/',
        title: 'Acme',
        excerpt: 'We build cloud tools and are scaling support.',
      },
    ],
  })

  console.log(JSON.stringify(out, null, 2))
}

main()
