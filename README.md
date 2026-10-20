# ScoutSpeak

**Find the right leads. Make better conversations. Learn from every outcome.**

ScoutSpeak is an AI-assisted prospecting workspace for small B2B service businesses. It turns a business profile and candidate companies into a source-backed lead table, prepares persona-based outreach, runs a browser voice conversation, and saves the transcript and outcome so the user can review what appears to work.


## Quick start

1. Copy `.env.example` to `.env.local` and fill in your Supabase URL and anon key:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

2. Install dependencies and run locally:

   ```bash
   npm install
   npm run dev
   ```

3. Open http://localhost:3000.


## App shell

The root layout includes a top navigation bar with links to:

- `/profile` — Business profile
- `/campaigns` — Campaigns
- `/leads` — Leads
- `/sessions` — Sessions
- `/dev/voice` — Voice smoke test (AAL2-protected)
- `/dev/ai` — AI ping (requires server-side AI config)

A development-only page at `/dev/ai` calls the temporary `/api/ai/ping` route and shows the validated AI response.

A protected `/dev/voice` page runs a voice/typed smoke test with the AI sales representative via `POST /api/voice/turn`.

## MVP pages

| Route | What it does |
|-------|--------------|
| `/profile` | Editable, versioned business profile. Every save inserts a new version; the current version and a short history are shown. |
| `/campaigns` | Create and edit campaigns (name, objective, status). Each campaign is linked to the latest business profile version. |
| `/leads` | Lead table with research status badges, lead status select, manual add (http/https URL required), delete confirmation, CSV import preview/report, and an idempotent "Load sample leads" button. |
| `/dev/voice` | Protected smoke-test page for spoken or typed conversation with the AI representative. |

## AI provider adapter

The server-only adapter lives in `src/lib/ai/`:

- `types.ts` — `ModelClient` interface (`generateJSON`, `generateText`).
- `errors.ts` — `AiError` with typed codes.
- `openai-compatible.ts` — fetch-based OpenAI-compatible client with timeout, rate-limit mapping, JSON repair, and Zod validation.
- `index.ts` — `getModelClient()` factory reading server-side env vars.

Configure it with:

```bash
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
AI_TIMEOUT_MS=20000
AI_PING_ENABLED=false
```

The temporary route `POST /api/ai/ping` returns `404` unless `AI_PING_ENABLED=true`. Set it to `true` only in safe, authenticated environments.

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


## Counter environment variables

| Variable | Used in | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Your Supabase project URL. Safe to expose in the browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Your Supabase anonymous/public API key. Safe to expose in the browser. |
| `SUPABASE_URL` | Server only (fallback) | Optional fallback for server-only clients. |
| `SUPABASE_ANON_KEY` | Server only (fallback) | Optional fallback for server-only clients. |

Never commit `.env.local` or the service-role key. The counter intentionally uses only the anon key and RLS so no service-role key is required.


## Counter database configuration

- Table: `public.counter` — single row `id = 1`, column `value`.
- RLS enabled with `anon`/`authenticated` policies for `select` and `update` on the single row.
- Atomic increment is performed by the PostgreSQL function `public.increment_counter()` invoked through Supabase RPC.
- The function uses `security invoker` so it respects RLS; the update policy restricts writes to the single seeded row.


## Authentication and MFA

The app uses Supabase Auth with email/password and mandatory TOTP two-factor authentication.

| Route | Purpose |
|-------|---------|
| `/signup` | Create an account. New Supabase projects require email confirmation, so the UI tells the user to check their inbox. |
| `/login` | Sign in. Users with no verified factor are redirected to `/mfa/enroll`; users with a verified factor but an AAL1 session are redirected to `/mfa/challenge`. |
| `/mfa/enroll` | Enrol an authenticator app, display the QR code and secret, and verify the first code. |
| `/mfa/challenge` | Complete the second factor on subsequent sign-ins. |

After a successful MFA challenge the session reaches AAL2 and the middleware allows access to protected routes and API endpoints.

## Database schema and RLS

The core ScoutSpeak schema lives in migration files (run them in order):

1. `supabase/migrations/0001_schema.sql` — creates the eight tables from `SPEC.md`.
2. `supabase/migrations/0002_rls.sql` — enables RLS, owner-based policies, and AAL2 enforcement.
3. `supabase/migrations/0003_enrichment.sql` — adds enrichment columns to `leads` and `lead_evidence`.

The existing counter migration is not modified.

## Lead enrichment

`packages/prospectkit/` holds the pure enrichment logic (schema, prompt, citation validation, fit scoring, and orchestration) with its own unit tests.

`src/lib/net/safe-fetch.ts` fetches public pages with IP pinning, redirect re-validation, and blocklists. `src/lib/net/extract.ts` converts HTML to an excerpt.

`POST /api/leads/[id]/enrich` fetches the lead URL plus up to two same-origin pages, stores `lead_evidence` rows, runs the model through `prospectkit`, and updates the lead. It maps `AiError` codes to HTTP 429/504/502 and never fabricates a successful result.

`/leads` shows research status, fit score, and fit label, with per-row **Enrich** / **Re-enrich** buttons. `/leads/[id]` displays the evidence panel, source-backed claims with clickable citation chips, and the fit breakdown.

## Conversation strategies

Versioned strategy configs live in `src/lib/strategies/` and are selected when starting a session:

- `consultative` — asks at least two discovery questions before mentioning the offer (max 10 turns).
- `concise` — uses at most two sentences per turn, one intro plus one qualifying question (max 6 turns).
- `objection-handling` — acknowledges the stated concern first, answers only with supported information, then offers a low-pressure next step (max 8 turns).

Use `getStrategy(key)` to look up a config by key and version. Unit tests cover shape, observable differences, and lookup behaviour.

## Voice smoke test

`src/lib/voice/types.ts` defines the provider-independent `VoiceSessionAdapter` and normalised event stream (`partial`/`final` transcript, `turn`, `status`, `error`) from `SPEC.md` Section 7.

`src/lib/voice/browser-speech.ts` implements recognition and speech-synthesis using the browser Web Speech API, with a typed fallback.

`src/lib/voice/managed-room.ts` is a stub that throws `not implemented` until a provider-backed room is chosen.

`POST /api/voice/turn` is AAL2-protected and validated with Zod. It accepts the last six turns plus a user message (max 500 characters) and calls `getModelClient().generateText`. The system prompt requires the agent to identify itself as an AI, keep replies to 1-2 short sentences, and invent no facts about the prospect or services. `AiError` codes are mapped to HTTP status codes; no canned text is returned.

`/dev/voice` is protected by the same AAL2 middleware. It starts with a spoken AI introduction, supports a microphone toggle (with unsupported-browser and permission-denied handling), always shows a typed input, records the input method per turn (`browser_speech` or `typed`), displays a live transcript, speaks the AI reply, and offers a retry on AI errors. No audio is stored and no session is persisted yet.

## Isolation test

`scripts/test-isolation.ts` creates two pre-confirmed test users, enrols and verifies TOTP for both, then asserts:

- A and B can each read their own rows.
- B cannot read, update, or delete A's rows via `supabase-js` or direct PostgREST calls.
- B cannot insert child rows pointing at A's parents or spoof A's `owner_id`.
- An AAL1 session cannot read the user's own rows.
- Anonymous requests read nothing.

Run it locally after setting `SUPABASE_SERVICE_ROLE_KEY`:

```bash
npm run test:isolation
```

## Scripts

```bash
npm run dev        # Start the Next.js dev server
npm run build      # Production build
npm run start      # Start the production server
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript checks
npm run test:unit  # Run vitest unit tests
npm run test:isolation  # Run the two-account RLS/MFA isolation test
```


## Manual Supabase configuration

After running the SQL migrations, change these settings in the Supabase dashboard:

1. **Auth → URL configuration**: add your production domain and `http://localhost:3000` for local development.
2. **Auth → Providers → TOTP MFA**: enable TOTP so users can enrol an authenticator app.
3. **Auth → Email templates**: confirm the confirmation email redirect URL points to your app (e.g. `/login`).

## Deployment

Deploy to any host that supports Next.js (e.g. Vercel). Set the environment variables from `.env.example` in the host's dashboard. Ensure the counter migration has been applied to the linked Supabase project before opening the app.
