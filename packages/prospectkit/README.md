# ProspectKit

Pure lead enrichment logic for B2B prospecting. Given a business profile and a
small set of public web-page excerpts, ProspectKit builds a prompt, asks a
language model for a structured, citation-backed evaluation, validates the
response, scores the fit, and reports how much trust the result deserves.

Built during the **Devmarketplace x NED hackathon** by **Muhammad Umer Safee**
and **[TEAMMATE NAMES]**.

> **Fetcher note:** ProspectKit does not fetch web pages for you. Bring your own
> fetcher. The ScoutSpeak app uses a safe-fetch implementation based on
> **Devmarketplace gig 32**.

## Install

```bash
npm install prospectkit
```

`prospectkit` depends on `zod` for runtime validation.

## Quick start

```ts
import { enrichLead, type ModelClient } from 'prospectkit'

const model: ModelClient = {
  async generateJSON({ schema, system, user }) {
    // Call your LLM here and validate with `schema.safeParse(result)`.
    // Return the parsed object.
  },
  async generateText({ system, user }) {
    // Optional: only used by some consumers, not by enrichLead.
    return ''
  },
}

const out = await enrichLead({
  model,
  profile: {
    business_name: 'TestCo',
    services: 'AI onboarding',
    value_proposition: 'Faster onboarding',
    target_industry: 'SaaS',
    target_geography: 'North America',
    constraints: 'Must be in North America\nMust mention cloud',
  },
  lead: {
    company_name: 'Acme',
    website_url: 'https://acme.example',
  },
  pages: [
    {
      tag: 'E1',
      url: 'https://acme.example/',
      title: 'Acme',
      excerpt: 'We build cloud tools and are scaling support.',
    },
  ],
})

console.log(out.status)   // 'verified' | 'partial' | 'unverified'
console.log(out.fit)      // score, label, breakdown, unknowns, reason
console.log(out.result)   // null when validation fails
```

See [`examples/basic.ts`](./examples/basic.ts) for a complete runnable example
using a fake model.

## Types

### `EnrichLeadInput`

| Field   | Type          | Description                                       |
|---------|---------------|---------------------------------------------------|
| `model` | `ModelClient` | Object with `generateJSON` and `generateText`.    |
| `profile` | `ProfileInput` | Your business profile and hard constraints.       |
| `lead`  | `LeadInput`   | Company name and website URL.                     |
| `pages` | `PageInput[]` | Page excerpts tagged `E1`, `E2`, `E3`, etc.       |

### `EnrichLeadOutput`

| Field    | Type               | Description                                                |
|----------|--------------------|------------------------------------------------------------|
| `result` | `EnrichmentResult \| null` | Validated model output, or `null` if validation failed. |
| `fit`    | `FitResult \| null`        | Fit score/label/breakdown, or `null`.                   |
| `status` | `ResearchStatus`           | `verified`, `partial`, or `unverified`.                 |

## Error handling

ProspectKit never fabricates a result. If the model response cannot be
validated, it returns:

```ts
{ result: null, fit: null, status: 'unverified' }
```

Common causes:

| Cause                                | Result                           |
|--------------------------------------|----------------------------------|
| Model returns malformed JSON         | `unverified`                     |
| Model cites a page tag it was not given | `unverified` (after one repair attempt) |
| Observed signal has zero citations   | `unverified`                     |
| Model throws or times out            | `unverified`                     |

The underlying `ModelClient` may surface provider errors (rate limits, timeouts,
etc.); ProspectKit surfaces those as `unverified` and leaves retry policy to the
caller.

## Rules ProspectKit enforces

1. **Untrusted page text** is wrapped in `<page tag="E1">...</page>` delimiters.
   The prompt tells the model not to follow instructions embedded in the text.
2. **Citation validation** rejects any evidence tag that is not in the allowed
   set of page tags.
3. **One repair** only. The supplied `schema` is passed to the model client's
   `generateJSON`, so the client may attempt one self-correction. ProspectKit
   does not add a second retry.
4. **Observed signal must be cited**. A result that claims a signal without
   evidence is invalid.
5. **Fit scoring** weights `offer_match`, `evidence_strength`, `constraint_fit`,
   and `stated_need` over known dimensions only. A violated hard constraint
   always yields label `excluded`.
6. **Research status** is `verified` only when at least two pages are available
   and the observed signal is cited; otherwise `partial` or `unverified`.

## License

MIT
