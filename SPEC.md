# ScoutSpeak

> Find the right leads. Rehearse the conversation. Learn from every outcome.

**One-line pitch:** ScoutSpeak helps small B2B service providers choose well-evidenced prospects and then hold a voice conversation with an AI sales representative grounded in the provider's real offer and the prospect's real context.

**Build window:** 19 October 2026, 9:00 AM PKT to 22 October 2026, 11:00 PM PKT
**Team:** [Team name], three members (Section 11)

---

## 1. Problem

Small agencies and freelancers win most work through conversations, but they prepare for them poorly.

- **Lead lists have no reason to call.** A company name alone gives no reason to start a conversation or any idea what that company needs.
- **Generic AI scripts are ungrounded.** They sound fluent but invent facts about the prospect, promise services the provider does not offer, and are never tested against realistic pushback.
- **Practice is hard to come by.** Rehearsing with a colleague is awkward and inconsistent, and nothing is recorded about what was said or what to change.
- **Learning is lost.** Outcomes sit in spreadsheets and chat threads, so the provider cannot see which approach works for which kind of prospect or which objections keep coming back.

ScoutSpeak answers one connected question: **Which prospect is worth approaching, what grounded conversation should I have with them, how did it go, and what should I change next time?**

### Who it is for

Solo professionals and small agencies without a sales-development team. The demonstration scenario is a web-development studio that sells website redesigns and small web applications to local and regional businesses.

### Why it matters

Unsuitable prospects and unprepared first calls cost a small provider scarce time that would otherwise go to delivery. ScoutSpeak replaces guesswork with a short, evidence-backed list of prospects, a grounded brief for each, a place to practise, and a record that shows what worked.

---

## 2. Solution

ScoutSpeak is one workflow in five stages:

1. **Define the offer.** The user describes their services and ideal customer. The profile is saved and versioned.
2. **Build a lead table.** The user imports a CSV or enters companies and public URLs. The server inspects the public pages and an AI model extracts structured, source-backed context for each company.
3. **Brief the conversation.** For a chosen lead, ScoutSpeak assembles a session brief from the business profile, the lead's stored evidence, the campaign objective and a conversation strategy. The user can read and edit it.
4. **Hold the conversation.** An AI sales representative speaks with a person in a browser conversation room. It follows the brief, responds to what the person actually says, and discloses that it is an AI.
5. **Review and learn.** ScoutSpeak saves the transcript, proposes an outcome and objection labels, and lets the user correct them. A dashboard groups results by session purpose so that practice results and real prospect results are never mixed.

The AI is the engine of the product, not a chat box bolted on. It performs evidence extraction, grounded dialogue and outcome extraction, while application code validates evidence, enforces claim rules, controls what is saved and computes every figure on the dashboard.

---

## 3. Core user journey

1. **Sign up and secure the account.** The user registers, enrols an authenticator app for TOTP two-factor authentication, and completes the challenge to enter the workspace.
2. **Set up the business.** The user enters services, value proposition, target industry, geography and constraints (for example "no discounting in a first call").
3. **Add leads.** CSV import, manual entry of company name and public URL, or a labelled sample set.
4. **Enrich leads.** The server fetches public pages and stores excerpts as evidence. The model returns a company summary, an observed business signal, a possible need (marked as an inference where the page does not state it), a personalised opening question and any missing information. Each lead is labelled verified, partial or unverified according to its evidence.
5. **Prepare a session.** The user opens a lead, chooses an objective and a strategy (Consultative, Concise or Objection-Handling), declares the session purpose (rehearsal or prospect conversation), and reviews the generated brief.
6. **Converse.** The user opens the session link. The AI representative introduces itself as an AI and holds a spoken, multi-turn conversation with whoever takes the counterpart seat. Typed input is available at all times.
7. **Review.** The model proposes a summary, outcome, objection tags and a follow-up suggestion, each with supporting transcript excerpts. The user accepts or corrects them and saves.
8. **Return.** After signing out and back in with 2FA, the profile, leads, evidence, transcripts and reviewed outcomes are all still there, including after an application restart.

---

## 4. The conversation room

Each session takes place in a browser conversation room with two sides: the **AI sales representative** and the **counterpart**, the person speaking as the prospect.

- **Session link.** Starting a session creates a scoped, expiring link. Whoever opens it takes the counterpart seat. The link grants access to that one session only, never to the workspace, the lead table or any other record.
- **AI representative.** A server-side participant in the room. It listens through speech-to-text, composes each reply with the language model under the session's claim rules, and speaks through text-to-speech.
- **Before the conversation starts.** The counterpart sees a notice that they are speaking with an AI representative and that the transcript will be saved, and must consent before the agent begins. A visible control lets them leave at any time.
- **Objection profile.** The user can set how the counterpart scenario should be approached for rehearsal (for example price-sensitive, already has a vendor, short on time), which the review uses when assessing handling.
- **Input.** Voice through hosted speech services, voice through browser speech APIs, or typed turns. The input method used is recorded on the session.
- **Session purpose.** Set by the user before the session starts and locked once it begins: `rehearsal` or `prospect_conversation`. Reporting in Section 5 is split on this field.
- **Status.** Sessions move through created, waiting for participant, active, completed, failed and cancelled. A failed connection, missing consent or lost audio produces `failed` or `cancelled`, never a completed session.

The room is accessed through the application's own `VoiceSessionAdapter` (Section 7), so the real-time voice provider is replaceable.

---

## 5. AI at the core

| Stage | Model context | Structured result | Application control |
|---|---|---|---|
| Lead enrichment | Business profile; fetched page excerpts with evidence IDs | Summary, observed signal, inferred need, opener, missing fields | Every cited evidence ID must exist and belong to the current run. Rows without adequate evidence stay partial or unverified |
| Strategy brief | Profile, lead evidence, objective, strategy definition | Goal, permitted claims, questions to prioritise, end conditions | Strategies are versioned. Claims about the provider must trace to the saved profile. Claims about the prospect must trace to lead evidence or to what the counterpart said |
| Conversation turns | Brief, rolling transcript, session purpose, objection profile | Next spoken reply | A server-side turn controller owns the system prompt and claim rules, ends sessions on defined conditions and discloses the AI |
| Outcome extraction | Full transcript and brief | Summary, suggested outcome, objection tags, follow-up, supporting excerpts | The model only suggests. The user confirms or corrects, and analytics use the confirmed value |

### Strategies

Three versioned profiles, each defining a goal, permitted claims, priority questions, tone and end conditions:

- **Consultative:** explores the prospect's problem before presenting the offer.
- **Concise:** a short, specific introduction followed by one qualifying question.
- **Objection-Handling:** acknowledges a stated concern, answers with supported information and offers a low-pressure next step.

Each strategy produces observably different conversational behaviour on the same lead, verified by comparing transcripts.

### Evidence rules

- A claim about a company is based on an inspected page. Search snippets are only used to find pages.
- Facts, inferences and unknowns are labelled separately.
- Fetched page text is treated as untrusted data and cannot change instructions, tools or permissions.
- No invented companies, contacts, prices, quotations or case studies.
- Fit is scored by application code from model-proposed 0-5 ratings on offer match, evidence strength, constraint fit and stated need. Hard constraints override the score, and any unknown dimension prevents a "strong fit" label. The score ranks leads for attention; it is not a prediction of a sale.

### Dashboard

All figures are computed from database records, never written by the model. Sessions are grouped by purpose.

- **Rehearsals:** session counts, strategies used, review notes on objection handling and missed opportunities, and repeat attempts per lead.
- **Prospect conversations:** counts and denominators of user-confirmed outcomes by strategy and lead segment, with date range and a small-sample notice. With too few sessions it displays an insufficient-data message instead of a trend.

Rehearsal results are never counted as prospect responses, meetings or conversions.

### Error handling

Structured model output is validated with one repair attempt. Timeouts, rate limits, invalid output and unreachable sources produce a visible retry state and keep all completed work. A provider failure never returns canned text in place of a live AI response.

---

## 6. Scope

### In the MVP

- Sign-up, sign-in, sign-out, TOTP 2FA and per-user data isolation.
- PostgreSQL persistence for every record.
- Editable, versioned business profile and a campaign setup.
- Lead table with CSV import, manual entry and sample data.
- Live AI enrichment with stored evidence, explicit uncertainty and a computed fit score.
- Three versioned conversation strategies and an editable session brief.
- Conversation room with an AI representative: voice and typed input, session link, consent notice, live transcript for the account owner.
- Session review with model-suggested and user-confirmed outcomes.
- Dashboard grouped by session purpose.
- Loading, empty, partial-result and recoverable error states throughout.

### Out of scope

Outbound phone calls, WhatsApp or SMS automation, joining third-party Zoom or Meet calls, bulk outreach, login-gated or paywalled scraping, contact-detail enrichment, a full CRM, payments, fine-tuning, local GPU hosting, scheduled campaigns and multiple businesses per account.

### Priority order

Work is sequenced so the end-to-end journey (Section 3) is complete first, then widened:

1. Auth with 2FA, database, isolation, profile and leads.
2. Enrichment, brief and a working AI conversation with review and saved results.
3. Session link and consent flow for a separate participant.
4. Dashboard and polish: strategy comparison, automatic strategy suggestion, public-web company discovery and call-interface refinements.

---

## 7. Technical approach

| Layer | Choice |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS and an accessible component library |
| Backend | Next.js server routes and actions for authentication checks, AI orchestration, page fetching, session control and validated writes |
| Database and auth | Supabase Postgres and Supabase Auth with TOTP MFA and row-level security. The workspace requires the elevated MFA assurance level |
| Language model | A hosted model chosen at kickoff from the available credits, behind a provider adapter that takes structured input and returns validated JSON. Keys and model IDs are server-side environment variables |
| Speech | Hosted speech-to-text and text-to-speech where available, with browser speech APIs and typed input as alternatives |
| Voice room | A managed WebRTC room or voice-agent service chosen at kickoff, behind `VoiceSessionAdapter` |
| Deployment | A managed Next.js-compatible host with hosted Postgres, confirmed on Day 1 to support the required server routes, real-time connections and runtime limits |
| Source control | Public GitHub repository with commits across the build window |

### VoiceSession adapter

The application depends only on `createSession`, `createParticipantInvite`, `joinSession`, `endSession`, `getSessionStatus` and a normalised stream of transcript and turn events. Session IDs and participant tokens are non-guessable, scoped to a single session and expiring.

### Lead page fetching

Public HTTP(S) destinations only, with timeouts, response-size and content-type caps. Loopback, private-network and metadata-service addresses are rejected, and redirects and resolved addresses are rechecked. Fetched content is never executed.

### Persistence

Each stage (enrichment, brief, turn batch, review) is saved before the next begins. The interface shows the last saved state, and interrupted work can be retried without repeating completed steps.

### Data model

Every user-owned table carries `owner_id` and is protected by row-level security.

| Table | Key fields |
|---|---|
| `business_profiles` | id, owner_id, business_name, services, value_proposition, target_industry, target_geography, constraints, version, timestamps |
| `campaigns` | id, owner_id, business_profile_id, name, objective, status |
| `leads` | id, owner_id, campaign_id, company_name, website_url, company_summary, observed_signal, inferred_need, personalization_hook, fit_score, score_breakdown (JSON), research_status (verified / partial / unverified), lead_status |
| `lead_evidence` | id, owner_id, lead_id, source_url, canonical_url, page_title, excerpt, observed_at, access_status |
| `conversation_sessions` | id, owner_id, lead_id, campaign_id, **session_purpose** (`rehearsal` / `prospect_conversation`, locked at start), session_status, input_method, strategy_key and version, business_profile_version, model and prompt version, participant_consent_at, started_at, ended_at |
| `conversation_messages` | id, session_id, owner_id, sequence_number, speaker_role (agent / human / system_event), message_text, created_at |
| `session_reviews` | id, session_id, owner_id, summary, outcome_suggested, outcome_confirmed, outcome_source (model_suggested / user_confirmed / user_corrected), objection_tags (JSON), next_step, quality_notes (JSON), note_text |
| `session_invites` | id, session_id, owner_id, token_hash, expires_at, used_at |

Outcome values: `interested`, `follow_up`, `meeting_requested`, `not_interested`, `not_a_fit`, `unclear`. A session link token identifies one session and exposes no `owner_id`, no other record and no credentials.

---

## 8. Privacy, security and responsible use

- Row-level security on every user-owned table, tested with two unrelated accounts by changing URLs and calling APIs directly.
- Provider and database-admin secrets never reach the browser or the repository.
- Authenticator-based TOTP with an enforced second-factor session for all protected requests.
- The AI representative identifies itself as an AI before every conversation.
- The counterpart sees what is transcribed and saved and must consent before the agent starts. They can leave at any time.
- Audio is not recorded or stored. Only the transcript is saved, as described in the notice.
- Demonstrations use synthetic or intentionally public lead data.
- Model context is kept minimal. Confidential or unnecessary personal data is not sent to hosted AI services.

---

## 9. Hackathon requirements map

| Requirement | How ScoutSpeak meets it |
|---|---|
| **M1 AI at the core** | Live model calls in enrichment, briefing, every conversation turn and outcome extraction, wrapped in evidence validation, claim rules and session state |
| **M2 Persistent data** | Supabase Postgres stores profiles, leads, evidence, sessions, messages and reviews |
| **M3 Auth with 2FA** | Supabase Auth with TOTP and RLS; two-account isolation tests run throughout the build |
| **M4 One complete journey** | Sign up, 2FA, profile, leads, enrichment, conversation, review, sign out, sign in, data still present |
| **M5 Repository and docs** | Public repository with README, this SPEC, `AI_DISCLOSURE.md`, and commits across 19 to 22 October (`PRIOR_WORK.md` only if applicable) |
| **M6 Two code gigs** | Section 12, published during the build |

---

## 10. Acceptance tests

Run on the deployed app in a private browser window.

1. A new user signs up, enrols TOTP, signs out, signs in and must pass the second factor.
2. Account B cannot read or change Account A's profile, leads, evidence, sessions, transcripts, invites or dashboard through the interface, edited URLs or direct API calls.
3. At least three leads can be added and enriched live. Each shows evidence references or an explicit partial or unverified label.
4. A conversation runs for several turns. The counterpart speaks, the AI replies in voice or text, and its replies respond to what was actually said.
5. The same lead run under two strategies produces observably different agent behaviour.
6. A session link opens in a separate browser or phone with no account. The AI and transcription notice appears, consent is recorded, and the conversation proceeds.
7. Expired links, missing consent, failed audio and abandoned sessions are recorded with the correct status and never as completed outcomes.
8. A completed session stores its purpose, transcript, strategy and profile version, suggested outcome and the user's correction, and remains after reload, new login and restart.
9. Dashboard figures use the confirmed outcome, show counts and denominators, keep rehearsals and prospect conversations separate, and show an insufficient-data message when there are too few sessions.
10. Provider timeout, rate limit, invalid model output and unavailable sources each show a recoverable error and keep completed work.
11. Every displayed citation resolves to stored evidence for that lead.

---

## 11. Team and delivery plan

### Roles

| Role | Responsibilities |
|---|---|
| **Product and frontend** ([Name], team lead) | Profile, lead table, session brief, conversation room UI, review, dashboard, join page, accessibility and responsive layout; scope and submission coordination |
| **Backend and security** ([Name]) | Schema, RLS, authentication and MFA enforcement, session and link permissions, persistence, deployment, cross-account tests |
| **AI and voice** ([Name]) | Enrichment and evidence validation, strategy definitions, turn controller, speech and voice-room integration, outcome extraction, evaluation |

All members share end-to-end testing, code review and demo preparation. One member owns the voice path from room to transcript.

### Schedule (PKT)

| When | Deliverable | Exit check |
|---|---|---|
| 19 Oct, 9 AM to 1 PM | Project created in Devmarketplace, app deployed, auth and database connected, one live AI call | Working app in progress shown at kickoff |
| 19 Oct, afternoon and evening | TOTP 2FA, RLS, profile and lead CRUD, voice-room smoke test with the AI representative | Two accounts isolated; agent hears and replies in a room |
| 20 Oct | Enrichment with evidence, strategy brief, conversation, review and save; first code gig published | Full journey works on the deployed app |
| 21 Oct | Session link and consent flow, dashboard, error states; second code gig published | Link joined from a second device |
| 22 Oct, until 8 PM | Fixes, full acceptance run, demo recording | All tests in Section 10 pass |
| 22 Oct, 8 to 11 PM | Final documentation and Devpost submission | URL, video, repository, two gig links, all members |

### Reuse

Established libraries (Next.js, Supabase client, a UI kit, a WebRTC or voice-agent SDK) and relevant Devmarketplace gigs are used where they fit. Every dependency, licence, model and AI coding assistant is listed in `AI_DISCLOSURE.md`. Product code is written inside the event window.

---

## 12. Code gigs

Two reusable utilities written during the event and extracted with setup steps, usage examples, error handling, tests, attribution and teammate credit.

1. **ProspectKit: evidence-backed lead enrichment.** A typed utility that takes a business profile and inspected page evidence, calls a configurable model, validates the structured result, rejects citations that do not exist, and returns an explainable fit assessment with a personalised opener.
2. **VoiceSession Router and Outcome Logger.** A provider-independent utility that combines lead context with a versioned strategy, manages turn state, normalises transcript events, and saves a session and reviewed outcome while keeping `rehearsal` and `prospect_conversation` sessions distinct. Includes tests for wrong-purpose writes.

---

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Voice-room integration takes longer than planned | Smoke test on Day 1; provider-independent adapter; typed and browser-speech input keep conversations working |
| Hosted model or speech quotas run out | Configurable adapters, short turns, bounded calls, quota checks on Day 1 |
| Microphone or speech recognition fails | Typed input always available; clear permission and error states; tested on desktop and mobile Chromium |
| Sites block fetching or hold little content | CSV and manual URLs are first-class; partial results are allowed; nothing is invented |
| The agent makes unsupported claims | Claim rules tied to the saved profile and lead evidence; citations shown in review |
| Rehearsal and prospect results get mixed | Purpose field locked at session start; analytics filter on purpose and confirmed outcome; dedicated acceptance test |
| 2FA or RLS slips | Built and tested on Day 1 and re-tested daily with two accounts |
| Scope grows | Priority order in Section 6; out-of-scope list is fixed |

---

## 14. Evaluation and next steps

During the build the team measures citation validity, strategy differentiation and journey completion on a small set of synthetic leads, and collects feedback from freelancers and small agencies on whether the lead brief and session review are clear and useful.

After the hackathon: scheduled re-enrichment, more voice and language options, CRM export, and optional phone-network calling with the consent and compliance review it requires.

---

## 15. Three-minute demo

1. Sign in with TOTP 2FA. (15 s)
2. Show the profile and lead table, run live enrichment, open one lead's evidence and fit reason. (40 s)
3. Start a session from that lead and hold a spoken conversation in which the AI representative handles two or three objections. (60 s)
4. Show the session review, correct an outcome, and show the dashboard grouped by session purpose. (35 s)
5. Open the session link on a second device and show the notice and consent step. (20 s)
6. Sign out and back in, and show that all data persists. (10 s)