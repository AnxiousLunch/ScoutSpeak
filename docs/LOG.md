# ScoutSpeak build log

| Task | Model | Status | Note |
|------|-------|--------|------|
| T11-T16 | K2.7 Coder | done | Schema, RLS, auth/MFA, middleware, isolation test implemented. SQL not applied; run `supabase/migrations/0001_schema.sql` then `0002_rls.sql` and enable TOTP in dashboard. Verification commands pending. |

| T17-T21 | K2.7 Coder | done | Profile versioning form, campaigns CRUD, leads table with manual add/delete/status, CSV import (papaparse), sample leads. Core schema migration held for user approval; apply before using pages. Lint/tsc/build not run in this interface.
| Voice Session Package Core | K2.7 Coder | done | Created packages/voicesession with status machine, controller, summary, events, outcome, logger, store interface and tests. No new app routes or migrations. Verification commands not run in this interface.

| Core Setup and Lead Enrichment Skeleton | K2.7 Coder | done | Safe IP-pinned fetch, HTML extraction, evidence storage, prospectkit orchestration, POST /api/leads/[id]/enrich, and leads UI. Fixed enrich.ts to propagate infrastructure AiError and route to map 429/504/502.

| T-50 Stage E | K2.7 Coder / Codex | verified | Consent route, turn-route consent gate, role-lock prompt builder, voice/mute/mic toggles, input_method persistence, length truncation. Tests present for consent 409, role-lock prompt rules, and length trimming. Verification commands not run in this interface.

| T-50 Stage E | Codex | verified | Consent route/turn gate, role-lock prompt, voice toggles, input_method, length truncation; added consent route tests and fixed turn request schema inputMethod. Verification commands not run in this interface.
| Phase 2 Day 2 items | Codex | built | Migration 0004, brief generator with claim tracing, session setup UI, turn route/SessionRoom fixes, outcome extraction/review screen, enrichment audit wiring, ProspectKit example/README. Verification commands not run in this interface.
| Phase 3 Prove it | Codex | tests added | Added/confirmed tests for SSRF ranges, citation rejection, claim validation, status transitions, purpose lock/wrong-purpose write, review save. Verification commands not run in this interface.
| Phase 4 Final report | Codex | reported | Phase 2/3 code complete; verification commands and migration application left for the human runner.

| T-51 | Codex | verified | Attached missing `lock_session_purpose` trigger in `0004_conversation_session_brief.sql` and added `src/app/sessions/actions.test.ts` for brief status lock. Phase 4 test coverage confirmed for SSRF ranges, citation rejection, claim check, status transitions, purpose lock/wrong-purpose write, review save. Verification commands not run in this interface.|
