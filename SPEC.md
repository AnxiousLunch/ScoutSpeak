# ScoutSpeak — AI Prospecting and Voice Conversion Studio

**Tagline:** Find the right leads. Make better conversations. Learn from every outcome.

## 1. Summary

ScoutSpeak is an AI-assisted prospecting workspace for small B2B service businesses. It helps a user define their ideal customer, discover or import company prospects, enrich the resulting lead table with source-backed research, and run personalized voice conversations using configurable sales personas. Every conversation is saved with its transcript and outcome. A feedback dashboard then summarizes which segments, messaging angles, and personas appear to work best.

ScoutSpeak is a closed loop rather than a disconnected lead list or chatbot:

**Business context → lead discovery → evidence-backed enrichment → persona routing → voice conversation → saved outcome → performance insights → improved next outreach.**

## 2. Problem

Small agencies, freelancers, and other B2B service providers often identify prospects manually, write generic outreach, and track responses across spreadsheets and messages. They have little evidence about which types of prospects respond, which objections recur, or which messaging approaches merit another attempt. Dedicated sales-development and CRM tools can be expensive or too complex for a small team.

ScoutSpeak focuses on one practical workflow: make a small, relevant prospect list actionable, help the user conduct consistent first conversations, and preserve the results so that future outreach can be better informed.

## 3. Target users and initial use case

**Primary user:** a small B2B service provider or agency without a dedicated sales-development team.

**Initial demonstration scenario:** a web-development agency looking for small and medium-sized businesses that may need a website refresh or a new web application.

The initial product is deliberately narrow. It does not attempt to replace a complete CRM, automate every sales channel, or support every industry at launch.

## 4. Scope and out of scope

### Scope:

- Turn a business's offer and ideal-customer profile into an actionable lead table.
- Keep company facts linked to public source URLs rather than presenting unsupported AI inventions as verified leads.
- Generate outreach that uses the lead's context and the user's chosen communication style.
- Demonstrate an interactive, browser-based voice conversation without requiring a GPU or paid phone-number service.
- Persist leads, conversations, transcripts, and outcomes in a real database scoped to the signed-in user.
- Summarize observed outcomes transparently, including when there is not enough data to make a useful comparison.

### Out Of Scope:

- Dialing real phone numbers or connecting to the public telephone network.
- Scraping LinkedIn, paywalled sites, private databases, or non-public personal contact information.
- Fine-tuning a model or training a custom speech model.
- Building a full CRM, email automation suite, team administration system, or multi-agent framework.
- Claiming that a persona has a higher conversion rate from a tiny or synthetic sample.

## 5. Main user journey

1. **Create an account and secure it.** The user signs up, signs in, and enrolls in time-based one-time password (TOTP) two-factor authentication using an authenticator app.
2. **Configure the business.** The user saves the business name, services, value proposition, target industry, ideal company size, geography, key problems solved, and preferred outreach style.
3. **Create a lead list.** The user searches for relevant companies using a best-effort public-web search adapter, imports a CSV, or supplies company names and public website URLs. A built-in demo dataset is available as a fallback for judges.
4. **Enrich and score leads.** A live AI model summarizes supplied public pages, extracts evidence-backed company context, identifies a potential fit with the user's offer, writes a short personalization hook, and produces a transparent fit score. Each researched lead retains source URLs and an indication of missing or uncertain information.
5. **Choose a persona and start a voice session.** The user selects a configurable style such as Consultative, Concise, or Objection-Handling. ScoutSpeak prepares an opening statement using the business profile and lead context. The conversation happens in the browser; the user can speak and hear the response, with typed input available as a fallback.
6. **Save the result.** When the conversation ends, ScoutSpeak proposes an outcome such as Interested, Follow-up, Not Interested, or Unclear. The user can confirm or correct it. The transcript, outcome, selected persona, timestamp, and associated lead are saved.
7. **Review feedback.** A dashboard shows counts and observed outcome rates by persona, lead segment, and messaging angle, plus recurring objections. It labels low-volume comparisons as preliminary and avoids ranking variants without enough observations.
8. **Return later.** The user signs out, signs in with 2FA, and still sees their saved lead list, conversation, outcome, and insights.

## 6. AI features and product logic

### A. Lead research and enrichment

The user supplies an ideal-customer profile and seed companies or a search query. The discovery adapter returns candidate company names and URLs where available. The server fetches only public pages and extracts a limited amount of text. A hosted language model converts the evidence into structured fields:

- Company summary
- Public source URL(s)
- Potential need or relevant business signal
- Match to the user's offer
- Suggested conversation opener
- Evidence confidence / missing fields

The model must not invent a website, contact detail, or company fact. A row without a verifiable source is labelled unverified or kept as an explicit suggestion rather than presented as researched fact. Search is best-effort and may be rate-limited; CSV and URL import remain dependable fallbacks.

### B. Persona router

The MVP uses one configurable hosted language model with several tested persona prompt profiles instead of running several separate models. A small, explicit router selects or applies the chosen profile and combines it with the business profile, lead evidence, and previous turns. The initial personas are:

- **Consultative:** asks about the prospect's problem and connects the service to a relevant need.
- **Concise:** gives a short, direct introduction and asks one clear qualifying question.
- **Objection-Handling:** acknowledges a stated concern and responds without pressure or invented claims.

Persona settings change the conversation strategy, not the truthfulness rules. The agent must identify itself as an AI assistant in the demo, avoid pretending to be a human, and stop or mark the outcome when a prospect declines.

### C. Speech interface

The primary demonstration is a browser voice session, not an outbound telephone call. A hosted speech-to-text endpoint transcribes user speech; the language model generates the agent's next turn; a text-to-speech endpoint speaks the response. Browser speech APIs and a typed-input mode are fallbacks because speech-recognition support varies by browser.

The MVP targets English-language conversations. Multilingual transcription can be explored if it works reliably, but Urdu speech synthesis is not a launch requirement.

### D. Outcome feedback

After each session, the AI may classify the transcript into a structured outcome and recurring objection. The user remains able to correct the classification. Analytics are computed from saved outcomes and are not model fine-tuning. ScoutSpeak reports simple, explainable statistics; it does not claim causal proof from small samples.

## 7. MVP features

### Must-have

- Sign-up, sign-in, sign-out, and a working TOTP 2FA enrollment/sign-in journey.
- PostgreSQL persistence and per-user row-level access control.
- Business profile form.
- Lead table with CSV import, manual company/URL entry, a small demo-data loader, and best-effort public-web discovery if time allows.
- Live AI enrichment and personalization, with source URLs and explicit uncertainty.
- Three selectable persona prompt profiles.
- Browser voice session with a typed-input fallback.
- Saved transcript, persona, timestamp, linked lead, outcome, and user correction.
- Dashboard showing lead counts, saved outcomes, and simple persona/segment summaries.
- Public repository, README, this SPEC, AI disclosure, and two published code gigs.
- Deployed demo that another person can use with their own account.

### Explicitly excluded

Real PSTN calling, payment handling, bulk email sending, CRM integrations, fine-tuning, complex vector databases, and any scraping of private or restricted sources.

## 8. Technical approach

The MVP prioritizes a small, maintainable web application that can be deployed within four build days and run without local GPU inference.

- **Frontend:** Next.js, React, TypeScript, and a lightweight component/styling system.
- **Backend:** Next.js server routes / server-side actions for protected database access and provider API calls.
- **Database and authentication:** Supabase Postgres and Supabase Auth, using TOTP MFA and row-level security policies.
- **Language model:** Groq-hosted `openai/gpt-oss-20b` (or equivalent paid model as required), an open-weight model under Apache 2.0, accessed through the provider's free plan when available. Model/provider identifiers stay configurable. This avoids local GPU inference while using an open-weight model.
- **Speech-to-text:** Groq-hosted Whisper (`whisper-large-v3-turbo`) on its available free quota, with browser speech recognition or typed input as fallback.
- **Text-to-speech:** Groq Orpheus English TTS (`canopylabs/orpheus-v1-english`) on its available free quota, with browser speech synthesis as fallback. The current endpoint accepts short text (up to 200 characters), so split longer replies into concise spoken turns.

Provider quotas, available model names, regions, and free-tier terms can change. Groq's published rate-limit table lists free-plan quotas for `openai/gpt-oss-20b`, Whisper, and Orpheus as of the time checked; re-check the current account limits before the build. API keys must stay server-side in environment variables. The app must return a clear retry/fallback message on rate limits rather than crash. Do not send confidential business information or personal data to unpaid AI endpoints; use public business facts and synthetic demo data for the hackathon.


## 13. Code gigs to publish

ScoutSpeak will extract and publish two reusable pieces of code written during the event:

1. **ProspectKit — Evidence-Backed Lead Enrichment Pipeline:** a typed utility that accepts a business profile and public company-page evidence, invokes an LLM, validates the structured output, preserves source URLs, and returns a fit explanation and outreach hook.
2. **VoicePersona Router — Voice Turn and Outcome Logger:** a provider-agnostic utility that combines persona prompts with lead context, orchestrates speech transcription / LLM response / speech synthesis, and saves a structured transcript and outcome.

Both gigs will include a clear README, setup instructions, environment variables, a small example, error handling, licence/source credits, and teammate contributor credit. Each piece will be authored and extracted from implementation work during the hackathon rather than uploaded as an unrelated pre-existing project.

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Free provider quota is exhausted or model access changes | Centralize provider calls in adapters; allow model IDs to be configured; provide a clear retry state and a tested fallback provider where practical. |
| Automated web search is blocked or unreliable | Keep CSV import, URL enrichment, manual entry, and demo data as first-class fallbacks. |
| Speech recognition is unsupported in a judge's browser | Use hosted Whisper where configured and always offer typed input; test in Chromium before the demo. |
| 2FA or row-level security is incomplete | Implement MFA and RLS on Day 1; test with two accounts every day. |
| Scope becomes too large | Exclude real phone calls, fine-tuning, CRM integrations, and bulk messaging. Protect the end-to-end user journey above all else. |
| Analytics overstate success | Show counts and small-sample warnings; treat AI summaries as suggestions, not proof of causality. |