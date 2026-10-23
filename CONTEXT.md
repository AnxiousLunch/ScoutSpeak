# ScoutSpeak — Current Context

## Project state

This is the ScoutSpeak repository: a Next.js 14.2.x App Router project with TypeScript, Tailwind CSS, shadcn/ui, Supabase Auth/Postgres, and a server-only AI provider adapter.

The repository is already set up with most of the Day-1 foundation. The latest changes made the Supabase-backed counter the homepage (`/`) as well as the canonical test route (`/count`), and fixed the auth form to use `onSubmit` instead of a client function as a form `action` (React 18 / Next.js 14 compatible).

## What is implemented

- **Counter**: persistent Supabase-backed counter at `/` and `/count`, atomic increment via `public.increment_counter()` RPC, loading/error states.
- **Supabase clients**: `src/utils/supabase/client.ts` (browser) and `server.ts` (server/SSR) using `@supabase/ssr`.
- **Database types**: `src/utils/supabase/database.types.ts` includes the counter table and the eight ScoutSpeak core tables.
- **Migrations**:
  - `supabase/migrations/20261019060525_create_counter_table_rpc_rls.sql` — counter table, seed row, RPC, RLS.
  - `supabase/migrations/0001_schema.sql` — ScoutSpeak 8-table schema.
  - `supabase/migrations/0002_rls.sql` — RLS, owner isolation, AAL2 restrictive policies.
- **Auth**: sign-up, sign-in, sign-out server actions; `/login`, `/signup`.
- **TOTP MFA**: `/mfa/enroll` (QR + secret + verify), `/mfa/challenge`.
- **Middleware**: session refresh, AAL2 enforcement, public routes (`/login`, `/signup`, `/count`, `/mfa/*`, static assets); API routes return JSON 401/403.
- **AI adapter**: `src/lib/ai/` with `types.ts`, `errors.ts`, `openai-compatible.ts`, `index.ts`; `POST /api/ai/ping` (404 unless `AI_PING_ENABLED=true`).
- **Dev page**: `/dev/ai` client page to run a live AI ping and show the validated JSON result.
- **App shell**: top nav, placeholder `/leads` and `/sessions` pages.
- **Isolation test**: `scripts/test-isolation.ts` with `npm run test:isolation`.

## Database status (important)

Only the **counter** table is applied in the linked Supabase project. The ScoutSpeak core schema (`0001_schema.sql`) and RLS policies (`0002_rls.sql`) are **pending** and must be run in the Supabase SQL Editor or approved in the workspace Database panel before authentication-protected features can work.

Run order:

1. `supabase/migrations/20261019060525_create_counter_table_rpc_rls.sql` (counter — already applied)
2. `supabase/migrations/0001_schema.sql`
3. `supabase/migrations/0002_rls.sql`

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Optional server fallbacks:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

For local isolation testing only (never deploy):

```bash
SUPABASE_SERVICE_ROLE_KEY=
```

For the AI ping/dev page (server only):

```bash
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
AI_TIMEOUT_MS=20000
AI_PING_ENABLED=false
```

## Manual Supabase dashboard settings

After applying the migrations, enable/configure in the Supabase dashboard:

1. **Auth → URL configuration**: add production domain and `http://localhost:3000`.
2. **Auth → Providers → TOTP MFA**: enable TOTP.
3. **Auth → Email templates**: confirm confirmation email redirect URL points to `/login`.

## Verification status

The following commands are defined in `package.json` and should be run locally:

```bash
npm install
npm run lint
npm run typecheck   # tsc --noEmit
npm run build
```

I cannot execute shell commands in this environment, so the actual lint/typecheck/build output is not available here. Run them locally and report any failures.

## Known risks / next steps

1. **Unapplied schema**: ScoutSpeak tables and RLS policies are not applied yet. This blocks sign-up/sign-in data persistence and the isolation test.
2. **AI ping**: `AI_PING_ENABLED=false` by default, so `/api/ai/ping` returns 404. Set it to `true` only with a valid `AI_API_KEY` to test the live adapter.
3. **Dashboard placeholder removed**: `/` is now the counter per the explicit routing decision. A real dashboard can be reintroduced later under a different route (e.g. `/dashboard`).
4. **Voice room, enrichment, brief, review, dashboard**: not built yet — these are the next major features after auth/schema verification.

## Files changed most recently

- `src/app/page.tsx` — now renders `CounterPage` (shared with `/count`).
- `src/app/layout.tsx` — nav updated: Counter, Leads, Sessions.
- `src/components/AuthForm.tsx` — uses `onSubmit` instead of function form `action`.
- `README.md` — nav description updated.
- `CONTEXT.md` — this file.
