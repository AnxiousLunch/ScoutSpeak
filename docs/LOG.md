# ScoutSpeak build log

| Task | Model | Status | Note |
|------|-------|--------|------|
| T11-T16 | K2.7 Coder | done | Schema, RLS, auth/MFA, middleware, isolation test implemented. SQL not applied; run `supabase/migrations/0001_schema.sql` then `0002_rls.sql` and enable TOTP in dashboard. Verification commands pending. |

| T17-T21 | K2.7 Coder | done | Profile versioning form, campaigns CRUD, leads table with manual add/delete/status, CSV import (papaparse), sample leads. Core schema migration held for user approval; apply before using pages. Lint/tsc/build not run in this interface.
| Voice Session Package Core | K2.7 Coder | done | Created packages/voicesession with status machine, controller, summary, events, outcome, logger, store interface and tests. No new app routes or migrations. Verification commands not run in this interface.

| Core Setup and Lead Enrichment Skeleton | K2.7 Coder | done | Safe IP-pinned fetch, HTML extraction, evidence storage, prospectkit orchestration, POST /api/leads/[id]/enrich, and leads UI. Fixed enrich.ts to propagate infrastructure AiError and route to map 429/504/502.

| T-50 Stage E | K2.7 Coder | done | Consent route, turn-route consent gate, role-lock prompt builder, voice/mute/mic toggles, input_method persistence, length truncation. Tests added. Verification commands not run in this interface.
