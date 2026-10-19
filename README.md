# ScoutSpeak

**Find the right leads. Make better conversations. Learn from every outcome.**

ScoutSpeak is an AI-assisted prospecting workspace for small B2B service businesses. It turns a business profile and candidate companies into a source-backed lead table, prepares persona-based outreach, runs a browser voice conversation, and saves the transcript and outcome so the user can review what appears to work.

This branch also contains a deployable **persistent Supabase-backed counter** at `/` and `/count` that tests the database connection and atomic server-side increments.


## Counter quick start

1. Copy `.env.example` to `.env.local` and fill in your Supabase URL and anon key:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

2. Apply the counter migration in the Supabase SQL Editor (or approve the pending migration in the workspace Database panel):

   ```sql
   create table if not exists public.counter (
     id int primary key,
     value int not null default 0
   );

   alter table public.counter enable row level security;

   insert into public.counter (id, value)
   values (1, 0)
   on conflict (id) do nothing;

   create or replace function public.increment_counter()
   returns int
   language plpgsql
   security invoker
   set search_path = public
   as $
   declare
     new_value int;
   begin
     update public.counter
     set value = value + 1
     where id = 1
     returning value into new_value;

     return new_value;
   end;
   $;

   grant execute on function public.increment_counter() to anon, authenticated;

   create policy "Allow public read access on counter"
     on public.counter
     for select
     to anon, authenticated
     using (true);

   create policy "Allow public update on counter"
     on public.counter
     for update
     to anon, authenticated
     using (id = 1)
     with check (id = 1);
   ```

3. Install dependencies and run locally:

   ```bash
   npm install
   npm run dev
   ```

4. Open http://localhost:3000 or http://localhost:3000/count.


## App shell

The root layout includes a top navigation bar with links to:

- `/count` — Persistent Supabase counter (the counter is also the homepage at `/`)
- `/leads` — Leads placeholder
- `/sessions` — Sessions placeholder

A development-only page at `/dev/ai` calls the temporary `/api/ai/ping` route and shows the validated AI response.

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

The core ScoutSpeak schema lives in two migration files (run them in order):

1. `supabase/migrations/0001_schema.sql` — creates the eight tables from `SPEC.md`:
   `business_profiles`, `campaigns`, `leads`, `lead_evidence`,
   `conversation_sessions`, `conversation_messages`, `session_reviews`,
   `session_invites`.
2. `supabase/migrations/0002_rls.sql` — enables RLS, revokes anon access, adds
   owner-based permissive policies, parent-ownership `WITH CHECK` constraints,
   and a restrictive AAL2 policy on every table.

The existing counter migration is not modified.

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
npm run test:isolation  # Run the two-account RLS/MFA isolation test
```


## Manual Supabase configuration

After running the SQL migrations, change these settings in the Supabase dashboard:

1. **Auth → URL configuration**: add your production domain and `http://localhost:3000` for local development.
2. **Auth → Providers → TOTP MFA**: enable TOTP so users can enrol an authenticator app.
3. **Auth → Email templates**: confirm the confirmation email redirect URL points to your app (e.g. `/login`).

## Deployment

Deploy to any host that supports Next.js (e.g. Vercel). Set the environment variables from `.env.example` in the host's dashboard. Ensure the counter migration has been applied to the linked Supabase project before opening the app.
