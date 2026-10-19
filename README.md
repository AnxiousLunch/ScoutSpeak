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


## Scripts

```bash
npm run dev        # Start the Next.js dev server
npm run build      # Production build
npm run start      # Start the production server
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript checks
```


## Deployment

Deploy to any host that supports Next.js (e.g. Vercel). Set the environment variables from `.env.example` in the host's dashboard. Ensure the counter migration has been applied to the linked Supabase project before opening the app.
