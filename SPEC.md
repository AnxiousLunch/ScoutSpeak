# ScoutSpeak — AI Prospecting and Voice Conversion Studio

**Tagline:** Find the right leads. Make better conversations. Learn from every outcome.

**Build window:** 19 October 2026, 9:00 AM PKT to 22 October 2026, 11:00 PM PKT  
**Status:** Proposed hackathon specification. The features and evaluation criteria below describe the planned build, not completed functionality or validated commercial results.

## 1. Summary

ScoutSpeak is an AI-assisted prospecting and voice-sales workspace for small B2B service businesses. It helps a user define their offer and ideal customer, build a small evidence-backed lead table, prepare relevant sales approaches, and run realistic voice conversations with a configurable AI sales representative. A user can rehearse alone by playing the prospect, or invite a real person to join a browser-based voice session. Both modes use the same business context and conversation engine, but their results are deliberately kept separate.

Each session produces a reviewable transcript, structured outcome, objection labels and follow-up suggestions. ScoutSpeak stores those results and uses confirmed observations from live-human conversations to compare lead segments and outreach strategies. Practice sessions help assess and refine scripts, but are never counted as real prospects, meetings or conversions.

The product is a decision-and-feedback workflow, not a prompt box connected to speech APIs:

**Business context → lead discovery → evidence-backed enrichment → strategy selection → interactive voice conversation → reviewed outcome → performance insights → improved next outreach.**

The MVP does not place calls to ordinary telephone numbers. Live conversations take place in an invitation-based browser voice room, keeping the build independent of phone-number provisioning and paid telephony. The voice-room service is replaceable behind an application interface rather than hard-coded into the product design.

## 2. Problem

Small agencies, freelancers and B2B service providers often identify potential clients manually, approach them with generic messages, and record the results inconsistently across spreadsheets and chats. They may know what they can deliver but have limited evidence about which prospects fit, which conversation approaches earn a useful response, and which objections appear repeatedly.

A generic lead list supplies company names without enough context to make the first conversation relevant. A generic chatbot can write a plausible sales script but does not necessarily ground it in the selected lead, maintain a conversation objective, record what happened, or change later recommendations based on observed outcomes.

ScoutSpeak addresses the connected workflow: **which prospects are worth approaching, what grounded conversation should be started with each one, how did the conversation actually go, and what should we try differently next time?** It aims to help a small team prepare and evaluate outreach rather than promise autonomous sales or guaranteed conversions.

## 3. Target users and initial use case

**Primary user:** a small B2B service provider, freelancer or agency without a dedicated sales-development team.

**Initial demonstration scenario:** a web-development agency offering website redesigns and small web applications to local and regional businesses.

The agency defines its services and ideal customers, imports or discovers a small list of companies, reviews source-backed reasons to approach them, and selects a lead for a personalized conversation. The agency can first rehearse with the AI sales representative, then invite a real colleague or consenting prospect to a browser-based voice session. The initial build supports one business profile and a bounded campaign, rather than attempting to be a full CRM or support every sector.

## 4. Goals and non-goals

### Goals

- Turn the business's actual offer and ideal-customer profile into a useful, reviewable lead table.
- Preserve public evidence and source URLs for researched company claims; distinguish verified observations from model inferences and unknowns.
- Generate context-aware conversation plans that reference the specific lead, offer, and campaign objective.
- Provide two distinct voice modes: solo practice with the user playing the prospect, and an invitation-based live conversation with a real human participant.
- Make solo practice realistic through dynamic turns, prospect objections, conversation goals, interruption handling where supported, and a session-end review rather than a fixed script playback.
- Save transcripts, mode, persona/strategy, lead context, outcome and user corrections in a persistent, user-scoped database.
- Use confirmed live-human outcomes to summarize observed performance by lead segment and strategy, while reporting practice results separately.
- Run without a local GPU and prioritize open-weight models and free hosted quotas where available.

### Non-goals for the hackathon MVP

- Automatically dialing mobile or landline numbers or placing calls over the public telephone network.
- Sending automated WhatsApp messages, joining third-party Zoom or Google Meet calls, or integrating with private messaging accounts.
- Scraping login-gated, paywalled, or restricted sites, or collecting non-public personal contact information.
- Fine-tuning models, building a new speech model, or hosting large models locally.
- Replacing a full CRM, performing bulk outreach, negotiating contracts, or claiming that AI independently closed a sale.
- Treating simulated practice as a real lead response, real meeting, or conversion.
- Claiming statistical significance, causal lift, or a superior persona on the basis of a handful of conversations.

## 5. Main user journey

1. **Create and secure an account.** The user signs up, signs in, and enrolls in authenticator-based TOTP two-factor authentication. The workspace requires the configured second-factor assurance for protected access.
2. **Configure the business.** The user adds the business name, offer, value proposition, target sector, geography, ideal company size, problem solved, and outreach constraints. The profile is editable and versioned so sessions retain the context they were built from.
3. **Create a lead list.** The user imports a CSV, enters company names and public website URLs, or uses a best-effort public-web discovery adapter. A small clearly labelled sample dataset is available as a fallback for testing the workflow.
4. **Research and rank leads.** A live AI call extracts structured company context from accessible public pages, identifies a potential fit with the business offer, creates a concise personalization hook, and reports missing or weak evidence. The table retains source URLs and an explainable fit breakdown.
5. **Prepare a campaign.** The user chooses the campaign objective and a conversation style, such as Consultative, Concise, or Objection-Handling. ScoutSpeak combines the confirmed business profile, the selected lead's evidence, the objective, and the strategy definition into a session brief. The user can inspect and edit the brief before starting.
6. **Choose a conversation mode.** In **Solo Practice**, the user speaks as the prospect while the AI represents the business. The user selects an objection/difficulty profile or lets the practice scenario choose one from a bounded set. In **Live Conversation**, the user creates an invitation link for a real participant to join a browser voice room; the AI represents the business and converses with that participant. Both modes must disclose that the representative is AI.
7. **Run a dynamic conversation.** The agent uses the lead context and current conversation state, responds to what the other person actually says, asks relevant qualifying questions, avoids unsupported claims, and follows the session objective. Typed input is available if audio devices or speech recognition fail.
8. **Review and save.** ScoutSpeak proposes an outcome and objection labels from the transcript. The user reviews or corrects them, adds a note, and saves the session. The mode is recorded explicitly so practice and real-human sessions cannot be confused.
9. **Inspect feedback.** The dashboard shows practice performance separately from observed live-human outcomes. Practice reviews focus on conversation quality and missed opportunities; live analytics summarize confirmed outcomes, repeated objections and results by lead segment or strategy. Small samples are clearly labelled preliminary.
10. **Return later.** After signing out and signing back in with 2FA, the user can reopen the profile, lead table, conversation history and feedback. All records survive page reloads and application restarts.

## 6. AI features and product logic

### A. Lead research and enrichment

The user supplies an ideal-customer profile, seed companies, URLs, or a search query. A discovery adapter returns candidate company names and public URLs where available. The server inspects accessible public pages and sends bounded extracts plus source metadata to a hosted language model. The model returns structured fields:

- Company summary and source URL(s)
- Observed public business signal relevant to the offer
- Potential need, clearly identified as an inference where not explicitly stated
- Match to the user's service and the evidence supporting that assessment
- Personalized conversation opener or qualifying question
- Missing fields, uncertainty and research status

Backend validation checks that cited evidence IDs exist and belong to the current research run. The model must not invent a company, source URL, contact detail or factual claim. A row without adequate evidence remains labelled unverified or partial, not presented as a verified prospect. CSV/manual entry and user-supplied URLs remain usable if automated discovery is unavailable.

### B. Campaign and persona router

The MVP uses one configurable hosted language model with distinct, versioned strategy profiles rather than requiring separate foundation models. The application router considers campaign objective, the selected lead's verified context, user constraints, session mode and prior confirmed results. The user may choose a strategy manually; automatic selection is a bounded recommendation, not an uncontrolled agent action.

Initial strategies:

- **Consultative:** asks about the business problem and explores whether the offer is relevant.
- **Concise:** gives a short, context-specific introduction and asks one clear qualifying question.
- **Objection-Handling:** acknowledges a stated concern, responds with supported information, and offers a low-pressure next step.

Strategy profiles define a goal, permitted claims, questions to prioritize, tone, conditions for ending, and structured end-of-session fields. Persona changes must produce meaningful, testable differences in conversational behavior; they are not merely labels or different greetings. Any claim about the provider's capability must be grounded in the saved business profile. Any claim about the prospect's business must be grounded in the selected lead's evidence or stated by the participant.

### C. Outcome extraction and feedback

After a session, the model proposes a structured summary, outcome, objection labels, follow-up recommendation and supporting transcript excerpts. Suggested outcomes include `interested`, `follow_up`, `meeting_requested`, `not_interested`, `not_a_fit`, and `unclear`. The user can correct or reject the suggestions; corrections are persisted.

Analytics are computed from database records, not generated as free-form numbers by the model. Practice sessions can be compared using the conversation-quality rubric and repeat attempts. Live-human outcome summaries can compare observed outcomes across lead segments and strategy variants, showing counts, denominator, date range and sample-size warnings. The dashboard must not blend the two populations or represent a generated role-play as a conversion. With little or no live data, it reports insufficient evidence and can still provide qualitative, clearly labelled feedback from practice.

### D. Application-owned decision logic

ScoutSpeak's own logic includes lead evidence validation, explainable fit calculations, hard-constraint checks, session-state management, strategy selection rules, transcript/outcome schemas, persistence, analytics aggregation and user correction. The LLM supplies bounded extraction, language generation, turn responses and suggested classifications. It does not control database permissions, invent citations, decide its own success metrics, or write directly to privileged tables. This separation ensures the product remains a real workflow rather than a thin chat interface around a model API.

## 7. MVP features

### Must-have

- Sign-up, sign-in, sign-out and working TOTP 2FA for the protected workspace.
- PostgreSQL persistence and per-user row-level access control.
- Editable business profile and a small campaign setup flow.
- Lead table with CSV import, manual company/URL entry, a labelled sample-data option, and best-effort public-web discovery if reliable.
- Live AI lead enrichment with stored source references, explicit uncertainty, and explainable fit assessment.
- Versioned Consultative, Concise and Objection-Handling strategy profiles with a lead-grounded session brief.
- **Solo Practice:** usable browser audio conversation with the user as the prospect, the AI as sales representative, variable objection/difficulty settings, dynamic responses, and a session-end review. Typed input is a reliable fallback.
- **Live Conversation:** invitation-based browser room for a second human participant to speak with the AI representative, using a replaceable real-time voice transport integration. The invited participant must not need a developer account.
- Clear labelling of `solo_practice` and `live_human` on session records and history.
- Saved transcript, session context/version, strategy, outcome proposal, user-corrected outcome, notes and timestamp.
- Feedback dashboard that keeps practice-quality results separate from reviewed live-human outcomes.
- AI disclosure, accessible loading/error states, and user-visible consent before a live session is transcribed.
- Public repo, README, this SPEC, AI disclosure, and two code gigs authored during the event.
- Deployed app that a judge can use with their own account and return to later.

### Cut first if behind schedule

1. Automated web search; retain CSV import, manual URL entry and sample data while keeping live enrichment functional on supplied evidence.
2. Automatic strategy selection; retain manual selection among the tested profiles.
3. Advanced analytics; retain separate session counts, outcomes and a simple strategy comparison with a small-sample warning.
4. Waveforms, animated avatars, streaming token effects and other decorative call UI; retain working, understandable audio turn-taking.
5. Voice accents, additional languages, multiple businesses per user and campaign scheduling.

The invited live-human voice mode is an explicit product goal, not something to quietly replace with a recorded demo. The team should integrate the room/transport early on Day 1 or Day 2 and test it with two browsers. If the chosen provider is unusable, choose an alternative compatible real-time voice transport rather than presenting Solo Practice as if it were a live-human call.

### Explicitly excluded

Outbound PSTN calls, connecting the agent to a user's personal SIM, automated WhatsApp messaging, unapproved bots in third-party meeting platforms, bulk cold messaging, payment handling, fine-tuning, a complex vector database, full CRM integrations and unattended autonomous outreach.

## 8. Technical approach

The MVP is a small web application deployable within four build days, using hosted inference and no local GPU. Provider choices must remain replaceable so the team can take advantage of available credits without making the architecture dependent on one company's API.

- **Frontend:** Next.js, React and TypeScript with a lightweight accessible styling/component system.
- **Backend:** server-side routes/actions for authentication checks, AI orchestration, session creation, validated database writes and protected provider calls.
- **Database and authentication:** Supabase Postgres and Supabase Auth, with TOTP MFA and row-level security. Enforce the configured MFA assurance level for protected workspace operations.
- **Language model:** a hosted inference endpoint, preferably an available open-weight model on a free quota for the MVP. A provider adapter should accept structured input and validated JSON output; model and provider IDs stay in server-side configuration. A frontier hosted model may be used if event credits make it the most reliable option, but it is not a product dependency.
- **Speech-to-text and text-to-speech:** hosted speech endpoints where available, with browser speech recognition and speech synthesis as fallbacks. Keep utterances short, handle service limits, and always retain typed input when microphone or speech services fail.
- **Real-time audio room:** a managed WebRTC-compatible room or voice-agent service selected during the build. The application integrates it through an interface for creating a room, issuing an expiring participant link, connecting/disconnecting the AI agent, forwarding audio/turn events, and reporting session state. The underlying provider is an implementation choice, not a named product requirement.
- **Voice orchestration:** a server-side turn controller manages session context, allowed claims, selected strategy, transcript messages, end conditions and outcome extraction. Do not place privileged credentials or trusted system prompts in client code.
- **Lead acquisition:** CSV/manual company and URL input first; a replaceable best-effort public search adapter is optional. Server-side page extraction must have strict timeouts and size limits.
- **Deployment:** a managed Next.js-compatible host and hosted Postgres, using free tiers where adequate. Confirm that the selected hosting plan supports the required server routes, WebSocket/WebRTC signaling needs and runtime limits before committing to it.
- **Source control:** public GitHub repository with meaningful commits distributed across the build window.

No free provider quota is guaranteed to remain available throughout judging. Check model access, speech limits, real-time room limits and hosting restrictions before committing. API keys stay server-side in environment variables. Provider exhaustion, invalid model output or audio failure must produce a clear retry/fallback state rather than a fake successful session. Use synthetic business data during initial tests and avoid sending confidential, sensitive or unnecessary personal data to unpaid endpoints.

### Voice-session adapter contract

The app should depend on its own interface rather than a specific voice vendor. At minimum, the adapter must support: `createSession`, `createParticipantInvite`, `joinSession`, `endSession`, `getSessionStatus`, and delivery of transcript/turn events. The exact transport may differ between Solo Practice and Live Conversation, but both write the same internal transcript/session format. Session IDs and participant tokens must be scoped, expiring and non-guessable. A participant invite grants access only to that specific session, never to the lead table or the user's workspace.

## 9. Data model

All user-owned records are scoped to the authenticated user. The minimum schema is:

### `business_profiles`

- `id` UUID primary key
- `owner_id` UUID tied to the authenticated user
- `business_name`, `services`, `value_proposition`
- `target_industry`, `target_geography`, `ideal_company_size`, `constraints`
- `profile_version`, `created_at`, `updated_at`

### `campaigns`

- `id` UUID primary key and `owner_id` UUID
- `business_profile_id`, `name`, `objective`, `target_segment`
- `strategy_key`, `strategy_version`, `status`
- `created_at`, `updated_at`

### `leads`

- `id` UUID primary key, `owner_id` UUID and `campaign_id` UUID where applicable
- `company_name`, `website_url`, `source_urls` JSONB
- `company_summary`, `observed_signals`, `fit_reason`, `personalization_hook`
- `fit_score`, `score_breakdown` JSONB, `research_status` (verified, partial, unverified)
- `lead_status` (new, ready, session_started, follow_up, not_a_fit, closed)
- `created_at`, `updated_at`

### `lead_evidence`

- `id` UUID primary key, `owner_id` UUID, `lead_id` UUID and optional `research_run_id`
- `source_url`, `canonical_url`, `publisher`, `page_title`, `published_at`, `observed_at`
- `excerpt`, `evidence_type`, `claim_supported`, `access_status`
- Evidence records are retained independently so a lead's explanation can resolve to an inspected source rather than a fabricated citation.

### `conversation_sessions`

- `id` UUID primary key, `owner_id` UUID, `lead_id` UUID, `campaign_id` UUID
- `interaction_mode` (`solo_practice` or `live_human`)
- `session_status` (created, waiting_for_participant, active, completed, failed, cancelled)
- `strategy_key`, `strategy_version`, `business_profile_version`, `model_provider`, `model_id`, `prompt_version`
- `transcript` JSONB or ordered child messages, `session_summary`
- `outcome_suggested`, `outcome_confirmed`, `outcome_source` (model_suggested, user_confirmed, user_corrected)
- `objection_tags` JSONB, `next_step`, `quality_review` JSONB
- `participant_consent_at`, `started_at`, `ended_at`, `duration_seconds`, `created_at`

### `conversation_messages` (if stored separately)

- `id` UUID primary key, `session_id`, `owner_id`, `sequence_number`
- `speaker_role` (agent, human, practice_user, system_event), `message_text`, optional timing metadata
- `created_at`

### `saved_notes` (optional if notes are stored on sessions/leads)

- `id` UUID primary key, `owner_id`, `lead_id`, optional `session_id`, `note_text`, `created_at`, `updated_at`

A single transcript design should be chosen early and implemented consistently. Do not add a complex event-stream database solely for the demo. A live invite token must not expose `owner_id`, other records, or privileged credentials.

## 10. Privacy, security, and responsible use

- Enable RLS on all user-owned tables and test policies with two unrelated accounts. Every server-side read and mutation validates session ownership.
- Never expose model, database-admin or voice-provider secrets in browser code or commit them to GitHub.
- Implement actual TOTP MFA and enforce the appropriate session assurance for protected workspace requests; a visual checkbox or mock challenge does not count.
- Limit page-fetching to public HTTP(S) destinations, set request timeouts and body-size caps, reject loopback/private-network/metadata-service targets, and re-check redirects and resolved destinations to reduce SSRF risk. Treat page content as untrusted instructions/data, never as authority over the agent or application.
- Do not scrape private, login-gated or restricted sources. Do not invent contacts or infer private personal contact information.
- Identify the voice participant as an AI representative before the conversation begins. For live-human sessions, explain whether speech is transcribed and saved, obtain affirmative consent before enabling the session, and provide an obvious way to leave or stop the agent.
- Do not record or persist audio by default unless it is genuinely needed and consented to. A transcript is stored only as described in the visible notice; users can end a session and remove test records through the supported UI where implemented.
- Use synthetic or intentionally public test leads in the demo. Do not present sessions with teammates or judges as real commercial opportunities or sales conversions.
- Keep practice transcripts and live-human transcripts distinguishable. The analytics query must filter by interaction mode and user-confirmed outcome before reporting observed live results.
- Unpaid hosted AI services may handle submitted content under terms that permit service improvement or human review. Avoid confidential information and minimize the personal data included in model context.

## 11. Success criteria and acceptance tests

The MVP is considered complete only when these tests pass on the deployed app:

1. A new user can sign up, enrol in TOTP 2FA, sign out, sign in again, and complete the second-factor challenge before protected workspace access.
2. User A cannot read or alter User B's profile, leads, sessions, transcripts, invite links or analytics by changing URLs or IDs.
3. A user can import or create at least three leads, run a live AI enrichment call, and see evidence references or an explicit partial/unverified label.
4. The user can open a lead, select a strategy, start Solo Practice, speak as the prospect, hear an AI-generated reply, and complete a multi-turn interaction that responds to their actual input rather than replaying fixed text.
5. Solo Practice can be run again with a different objection or strategy. The session review saves separately from business outcomes and does not appear in live conversion counts.
6. The user can create an expiring invitation link and a second participant can join from a separate mobile or desktop browser without a developer account. The participant receives the AI/transcription notice, gives consent, and can speak with the live AI representative.
7. Ending or abandoning a live session records the correct status. Failure to join, lack of consent or audio errors must not be silently recorded as a completed conversation or a successful outcome.
8. A completed session stores its mode, transcript, strategy, prompt/profile version, suggested outcome and user correction. It is still visible after page reload, a new login and application restart.
9. The user can correct an outcome classification. Analytics use the corrected, user-confirmed outcome; practice and live-human results appear in separate views or clearly separate sections.
10. The dashboard shows counts and denominators for strategy/segment comparisons and a clear insufficient-data message when there are too few observations. It never labels practice as a real conversion.
11. Provider timeout, rate limit, invalid structured output, unavailable source and audio failure show recoverable errors without discarding completed database work.
12. The public deployment works in a private browser window; judges can create their own accounts, use the AI feature, and return to persisted results.
13. README, SPEC, AI_DISCLOSURE, and two authored code gigs are public. Commits show work distributed across 19–22 October, and the demo video is no longer than three minutes.

## 12. Team and readiness

Work is divided across the following responsibilities; adjust the split to the actual team's size and skills:

- **Product and frontend:** user journey, business profile, lead table, practice UI, invite/join screens, transcript review, dashboard and responsive layout.
- **Backend and security:** database schema/RLS, authentication/MFA enforcement, invite/session permissions, persistence, deployment and protected provider calls.
- **AI and voice pipeline:** evidence extraction, fit scoring, strategy router, turn orchestration, speech integration, outcome extraction and evaluation.
- **QA and release:** cross-account isolation tests, two-browser live-session tests, provider failure cases, README/AI disclosure, demo script and code-gig publishing.

For a two-person team, combine product/frontend with QA/release and backend/security with AI/voice. For three or four members, distribute the work while assigning one person clear ownership of the live voice path. Everyone shares end-to-end testing and demo preparation. Team-specific names and registration details are supplied through the hackathon submission.

Use maintained libraries and available hosted services where appropriate. Record the actual libraries, licences, AI models, coding assistants and any reused components in `AI_DISCLOSURE.md`. The submitted pitch repository remains documentation-only until the organizers permit implementation work.

## 13. Code gigs to publish

ScoutSpeak will extract and publish two reusable pieces written during the event, with setup instructions, example usage, error handling, licence/source attribution and teammate credits.

1. **ProspectKit — Evidence-Backed Lead Enrichment:** a typed utility that accepts a business profile and inspected public-page evidence, invokes a configurable LLM, validates structured results, preserves source references and returns an explainable fit assessment plus a relevant conversation opener.
2. **VoiceSession Router and Outcome Logger:** a provider-independent utility that combines lead context and a versioned strategy profile, manages conversation state across Solo Practice and Live Conversation, normalizes transcript events, and persists a structured session and reviewed outcome. It must keep `solo_practice` and `live_human` distinct.

Each gig will include a clear purpose, prerequisites, environment variables, minimal working example, provider-adapter contract and tests for invalid citations or incorrect session modes. Only code authored by the team during the hackathon will be extracted as the gig; third-party framework code will not be republished as original work.

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Free model or speech quotas are exhausted or model access changes | Use configurable provider adapters, short turns and bounded calls; test available quotas early; provide retry/fallback states and avoid tying the product to one model. |
| Live audio-room integration takes longer than expected | Prove a two-browser audio session early, before polishing the lead dashboard. Keep the interface provider-independent and retain a fully working Solo Practice path. Do not mislabel practice as a live-human session. |
| Browser audio permissions or speech recognition fail | Test on a Chromium desktop and mobile browser, use hosted speech endpoints where available, provide typed input and show clear permission/error states. |
| Search is blocked or sources lack useful evidence | Keep CSV import and manual URL entry first-class; allow partial results and do not invent missing company details. |
| The agent makes unsupported claims | Ground the agent in the confirmed business profile and stored lead evidence, apply claim rules, show citations on review, and stop or qualify a claim when its support is missing. |
| Simulated and actual outcomes become mixed | Store an immutable interaction mode and make analytics explicitly filter by mode and reviewed outcome. Add acceptance tests for the separation. |
| 2FA or row-level security is incomplete | Implement MFA and RLS on Day 1; test with two accounts every day. |
| Scope expands into phone/WhatsApp integrations | Exclude PSTN dialing and messaging from the MVP; prioritize the browser invite room and full persistent journey. |
| Small samples make the analytics misleading | Show counts and sample-size warnings, use practice only for quality feedback, and describe live results as observed outcomes rather than causal proof. |

## 15. Final demonstration plan

The three-minute demo will show one complete, honest journey:

1. Sign in and complete TOTP 2FA.
2. Open the business profile, create/import a small lead list, and run live AI enrichment. Inspect one lead's evidence and the reason it fits the offer.
3. Start Solo Practice. The AI sales representative uses that lead context, responds dynamically to two or three spoken objections, and produces a session review. Show that the session is labelled as practice.
4. Open Live Conversation, create an invite link, and have a second browser or device join with consent. Demonstrate at least one genuine exchange with the AI representative. If the time limit prevents a second participant from joining during the recorded video, show the clearly labelled invitation/join flow and include a separate live test during judging; do not claim a simulated session is a real prospect call.
5. Save or correct the session outcome and show that practice feedback is separated from live-human outcome analytics.
6. Refresh the deployed app or sign out and back in; show the lead, transcript and reviewed result still exist.

The final submission will include the deployed URL, public GitHub repository, updated SPEC, README, `AI_DISCLOSURE.md`, two published Devmarketplace gig links, all team members, and a public or unlisted demo video no longer than three minutes. Any results presented must be the actual outputs observed during the demo, not implied commercial performance.
