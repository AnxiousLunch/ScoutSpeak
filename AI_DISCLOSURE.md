# AI Disclosure — ScoutSpeak

## Direct runtime dependencies

All runtime dependencies are declared in the root `package.json` and package workspaces.

| Dependency | License | Use |
|---|---|---|
| `@supabase/ssr` | MIT | Server auth cookies and session refresh |
| `@supabase/supabase-js` | MIT | Supabase auth and database client |
| `clsx` | MIT | Conditional class names |
| `html-to-text` | MIT | Extract readable text from fetched pages |
| `next` | MIT | Web application framework |
| `papaparse` | MIT | CSV lead import |
| `react`, `react-dom` | MIT | UI runtime |
| `tailwind-merge` | MIT | Merge utility classes |
| `undici` | MIT | SSRF-safe HTTP requests |
| `zod` | MIT | Runtime validation |
| `prospectkit` | MIT | Workspace lead enrichment package |
| `voicesession` | MIT | Workspace session controller package |

## Direct development dependencies

| Dependency | License | Use |
|---|---|---|
| `@types/html-to-text`, `@types/node`, `@types/papaparse`, `@types/react`, `@types/react-dom` | MIT | Type declarations |
| `autoprefixer`, `postcss`, `tailwindcss` | MIT | CSS build pipeline |
| `eslint`, `eslint-config-next` | MIT | Linting |
| `otplib` | MIT | TOTP test utilities |
| `tsx` | MIT | TypeScript script and example runner |
| `typescript` | Apache-2.0 | Type checking and builds |
| `vitest` | MIT | Unit tests |

Workspace packages also depend directly on `zod` (MIT). Transitive dependencies
are recorded in `package-lock.json`; their licenses remain governed by their
respective package metadata.

## Models and AI assistance

- Live AI model: selected by the private `AI_MODEL` environment setting through
  the OpenAI-compatible provider adapter. The credential and endpoint remain in
  the local environment and are not included here.
- AI coding assistant used for earlier implementation: Kimi K2.7 Coder.
- AI coding assistant used for this verification and implementation pass: Codex
  (GPT-6).
- No AI-generated image assets are included in this scope.
