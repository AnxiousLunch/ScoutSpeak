# ScoutSpeak

**Find the right leads. Make better conversations. Learn from every outcome.**

ScoutSpeak is an AI-assisted prospecting workspace for small B2B service businesses. It turns a business profile and candidate companies into a source-backed lead table, prepares persona-based outreach, runs a browser voice conversation, and saves the transcript and outcome so the user can review what appears to work.


## Core journey

1. Sign up, sign in, and complete TOTP two-factor authentication.
2. Save the business profile and ideal customer profile.
3. Import CSV leads, enter public company URLs, or use best-effort discovery.
4. Enrich leads using a live hosted AI model and preserve source URLs/uncertainty.
5. Start a browser-based voice or typed conversation using a persona.
6. Save the transcript and proposed/corrected outcome.
7. Review outcome summaries and return later to find the data still saved.

## Planned stack

- Next.js, React, TypeScript
- Supabase Auth, Postgres, and row-level security
- Groq-hosted `openai/gpt-oss-20b` (or equivalent models) for the language-model pipeline when its free quota is available
- Groq-hosted Whisper transcription and Orpheus English TTS where free quota permits
- Optional Gemini API backup only if the primary provider cannot be used
- Browser speech/typed-input fallbacks
- Vercel Hobby or another compatible free host

Check the actual model IDs, provider policies, quotas, and library licences used in the final build. Do not commit API keys or submit confidential/personal information to unpaid AI endpoints.


## Links (fill in before final submission)

- Live deployment: **TODO**
- Devpost submission: **TODO**
- Devmarketplace gig 1: **TODO**
- Devmarketplace gig 2: **TODO**
- Demo video (3 minutes max): **TODO**
