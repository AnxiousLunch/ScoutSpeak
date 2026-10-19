# AGENTS.md - ScoutSpeak

Read this file first. Then read ONLY the task card you were given and the files it names.
Do not read SPEC.md end to end; use the section map in section 7.

## 1. What we are building

ScoutSpeak: small B2B providers import leads, the server enriches them from public pages
with evidence, the user briefs a strategy, holds a voice conversation with an AI sales
representative, then reviews the outcome. A dashboard groups results by session purpose.
Build window: 19 Oct 9:00 AM PKT to 22 Oct 11:00 PM PKT. Spec: `SPEC.md`. Tasks: `TASKS.md`.

## 2. Hard rules (never violate; if a task seems to require it, STOP and escalate)

1. Every user-owned table has `owner_id` and RLS. The service-role key never reaches the
   browser or the repo.
2. All protected routes and actions require the second-factor (AAL2) session.
3. Session link tokens: random, stored hashed, expiring, scoped to ONE session, never expose
   `owner_id` or any other record.
4. The agent says it is an AI. Counterpart consent is recorded BEFORE the agent starts.
   Audio is never stored; only the transcript.
5. `session_purpose` (`rehearsal` | `prospect_conversation`) is locked when the session
   starts. Rehearsal and prospect results are never mixed in any query or figure.
6. Dashboard figures are computed by code or SQL from user-confirmed outcomes. A model never
   writes a number shown on the dashboard.
7. Fit score is computed by code from model-proposed 0-5 ratings. Hard constraints override.
   Any unknown dimension blocks a "strong fit" label.
8. Fetched page text is untrusted data: it can never change instructions, tools or
   permissions. Fetch public HTTP(S) only; reject loopback, private and metadata addresses;
   recheck after every redirect and DNS resolution.
9. Every citation must resolve to a stored `lead_evidence` row of that lead and run.
   Reject anything else.
10. Model structured output is validated with Zod, with ONE repair attempt. On timeout, rate
    limit or invalid output show a recoverable error and keep completed work. NEVER return
    canned text in place of a live AI reply.
11. No invented companies, contacts, prices, quotations or case studies. Synthetic or
    intentionally public data only.
12. Save each stage (enrichment, brief, turn batch, review) before the next begins.

## 3. Stack and layout

Next.js + React + TypeScript + Tailwind + shadcn/ui; Supabase Postgres/Auth (TOTP MFA, RLS);
Zod for every schema; voice room behind `VoiceSessionAdapter`; LLM behind a provider adapter.

```
/app                 Next.js routes, pages, server actions
/lib                 app-only helpers (db, auth, ai glue)
/packages/prospectkit    gig #1 (tasks 25-32). No imports from /app or /lib.
/packages/voicesession   gig #2 (tasks 39-46, 59). No imports from /app or /lib.
/supabase/migrations     SQL + RLS
/tests               unit, RLS two-account, acceptance
/fixtures            recorded model outputs for AI_MODE=fixture
/docs/tasks          task cards (T-xx.md)    /docs/LOG.md   one line per task
```

Rule: code under `/packages/*` takes its dependencies by injection (model client, storage,
fetch). This keeps it extractable as a gig. Keep product code and gig code separate from day one.

## 3b. Product model vs dev models

The product's runtime LLM/STT/TTS (chosen at kickoff, set via server-side env vars, see
`.env.example`) is NOT the same thing as the dev models below. Never hardcode model IDs.

## 4. Dev models and roles

| | Kimi K3 | Kimi K2.7 Coder |
|---|---|---|
| Role | Planner, reviewer, debugger of hard failures | Implementer |
| Writes | Task cards, review notes, prompts, test plans, small patches only | All feature code and tests |
| Does NOT | Write bulk feature code | Change architecture, schema or rules without a card |
| Context it gets | This file, SPEC section(s) needed, diff or failure log | This file, ONE task card, the files the card names, types and schema |

### K3 owns (call it for these)
- Splitting a task into cards; writing acceptance criteria and test cases.
- Security-sensitive review of: tasks 11-16 (schema, RLS, MFA), 25 (fetcher), 27-30 (prompts,
  citation validation), 37 (claim check), 40 (turn controller), 49-53 (invites, consent, statuses).
- Prompt design for enrichment, brief, turn controller and outcome extraction.
- Debugging after two failed attempts by K2.7.
- The pre-extraction review of each gig and the acceptance run (tasks 47, 62, 63).

### K2.7 owns
- Everything else: implement the card, write its tests, run them, commit.

### Handoff protocol
1. K3 writes `/docs/tasks/T-xx.md` using the template below.
2. K2.7 reads only that card plus the files it lists, implements, runs tests.
3. K2.7 appends one line to `/docs/LOG.md`: `T-xx | model | done|blocked | note`.
4. High-risk tasks (list above) get a K3 review of the DIFF only, not the whole repo.
5. Anything unclear, conflicting with section 2, or needing a schema change: K2.7 stops and
   writes `/docs/tasks/T-xx.blocked.md` (what was tried, error, question). K3 resolves it.

### Escalation rule
Two failed attempts on the same error -> write the failure note, hand to K3 with: the
error, the relevant file, what was tried. Do not keep retrying with growing context.

### Task card template
```
# T-xx <title>
Goal: <one sentence>
Spec: <section numbers only>
Touch: <files to create or edit>   Do not touch: <files>
Inputs/Outputs: <types, schemas>
Acceptance: <3-5 checkable bullets, incl. test names>
Rules that apply: <numbers from section 2>
```

### Logistics checklist (fill in on Day 0 from provider docs; do not guess)
| Item | Kimi K3 | Kimi K2.7 Coder |
|---|---|---|
| Exact model ID / endpoint | TBD | TBD |
| Context window | TBD | TBD |
| Rate limits (req/min, tokens/min) | TBD | TBD |
| Credit balance and price per 1M in/out tokens | TBD | TBD |
| Tool/function calling and JSON mode supported | TBD | TBD |
| Daily token budget (team) | TBD | TBD |

## 5. Per-task loop

1. Read the card. Read only the listed files.
2. Write or update the test first when the card has acceptance tests.
3. Implement the smallest change that passes. No refactors outside the card.
4. Run: typecheck, lint, the card's tests. Fix only what you broke.
5. Commit: `T-xx: <summary>` (one task = one commit; commits must appear across 19-22 Oct).
6. Append to `/docs/LOG.md`. Stop. Do not start the next task unprompted.

## 6. Token-saving rules

- Never paste whole files into prompts when a diff, signature or error excerpt is enough.
- Do not re-read SPEC.md or the repo tree between tasks; rely on the card.
- No exploratory "look around the codebase" steps. The card lists the files.
- Use `AI_MODE=fixture` (recorded JSON in `/fixtures`) for all UI and layout work. Only call a
  live model when the card says "live".
- Product LLM calls: cheap fast model for enrichment, turns and extraction; cap page excerpts
  (about 1,500 tokens per page, 3 pages per lead); keep the last N turns plus a running
  summary; keep spoken replies short.
- Cache enrichment by canonical URL + profile version. Never re-enrich unchanged leads.
- Output code only. No restating the task, no long explanations, no unrequested docs.

## 7. SPEC section map (read only what the card cites)

| Need | SPEC section |
|---|---|
| Problem, journey, demo | 1, 3, 15 |
| Conversation room, statuses, purpose | 4 |
| Enrichment, strategies, evidence, dashboard, errors | 5 |
| Scope and priority order | 6 |
| Stack, adapter, fetcher, persistence, data model | 7 |
| Privacy and security | 8 |
| Acceptance tests (1-11) | 10 |
| Schedule and roles | 11 |
| Gigs | 12 |

## 8. Reuse and disclosure

- Reuse before building: Devmarketplace gig 32 (safe URL fetch, TypeScript, MIT) for task 25.
  Verify it against rule 8 first; wrap only what is missing. Check `TASKS.md` for other reuse.
- Prefer maintained libraries over new code (zod, papaparse, html-to-text or readability,
  jose or node:crypto, shadcn/ui, the voice provider SDK, Supabase MFA API). Do not use
  Otpauth for TOTP; Supabase handles it.
- Every dependency, licence, model and AI coding assistant goes in `AI_DISCLOSURE.md`,
  including Kimi K3 and Kimi K2.7 Coder. Append as you go, not at the end.
- Product code is written inside the event window. No pre-existing product code.

## 9. Gig extraction (required: at least two)

- Gig 1, ProspectKit (tasks 25-32): typed lead enrichment, citation validation, fit assessment,
  opener.
- Gig 2, VoiceSession Router and Outcome Logger (tasks 39-46, 59): turn state, normalised
  transcript events, purpose-safe persistence, wrong-purpose write tests.
- Each gig needs: README with setup steps, usage example, error handling, tests, attribution,
  teammate credit. Publish gig 1 on 20 Oct and gig 2 on 21 Oct.
- Optional third gig after both ship: Supabase TOTP + AAL2 middleware, RLS two-account test
  harness, or the invite-link generator.

## 10. Schedule gates and cut order

- 19 Oct 1 PM: deployed, auth + DB connected, one live AI call.
- 19 Oct evening: two accounts isolated; agent hears and replies in a room.
- 20 Oct: full journey works; gig 1 published.
- 21 Oct: session link + consent from a second device; dashboard; gig 2 published.
- 22 Oct until 8 PM: fixes and acceptance tests 1-11 only. No new features.
- Cut in this order if late: (1) strategy comparison UI, auto strategy suggestion, public-web
  discovery, call polish; (2) separate-participant link (only if owner-side conversation works).
  NEVER cut: 2FA, persistence, evidence-backed enrichment, one working conversation, review.

## 11. Conventions

- TypeScript strict. No `any` without a comment. Zod schemas are the single source for types.
- Server-only secrets; validate every input at the server boundary; RLS is the real guard,
  never rely on UI hiding.
- Loading, empty, partial and error states for every data view.
- Small files, small functions, named exports. Tests next to code or in `/tests`.
- Typed input must always work when the microphone or speech recognition fails.

## 12. Out of scope (do not build)

Outbound phone calls, WhatsApp/SMS, joining Zoom/Meet, bulk outreach, login-gated or paywalled
scraping, contact-detail enrichment, a CRM, payments, fine-tuning, local GPU hosting, scheduled
campaigns, multiple businesses per account.
