---
name: nextjs-14-conventions
description: Enforce the project's Next.js 14.2.x App Router, TypeScript, Supabase SSR, and server/client boundaries. Use whenever creating or modifying application routes, components, middleware, authentication, configuration, or server-side integrations.
---

# Next.js 14 Conventions

## 1. Source of Truth

- Follow `SPEC.md`, `AGENTS.md`, and the existing lockfile.
- Use Next.js 14.2.x for this project unless the repository or explicit project requirements establish otherwise.
- Do not upgrade Next.js, React, Supabase, or other core dependencies without a demonstrated need and explicit approval.
- Inspect `package.json`, the lockfile, and existing directory structure before making assumptions.
- Use the existing package manager and scripts.
- Do not introduce `next.config.ts`; use a configuration format supported by the installed Next.js version.

## 2. App Router and Structure

- Use the App Router and the existing `src/` structure if present.
- Keep route handlers in `app/api/.../route.ts` or `src/app/api/.../route.ts`, consistent with the repository.
- Keep shared domain types, validation schemas, and business logic in reusable modules.
- Separate server-only modules from client components.
- Avoid duplicating logic across pages and route handlers.
- Prefer small, focused modules over large files that mix database access, business rules, and presentation.

## 3. TypeScript

- Keep strict type checking enabled where supported by the existing project.
- Avoid `any`. Prefer inferred types, explicit domain types, `unknown` with validation, and generated database types.
- Validate untrusted inputs at runtime; TypeScript types do not validate network requests.
- Reuse Zod schemas where applicable instead of defining inconsistent prompt, API, and persistence shapes.
- Handle nullable values and errors explicitly.

## 4. Server and Client Boundaries

- Default to Server Components.
- Add `"use client"` only when browser APIs, event handlers, or client-side state are required.
- Never import server-only secrets or privileged database clients into client components.
- Never expose API keys through `NEXT_PUBLIC_*` variables.
- Do not rely on hidden UI controls as authorization.
- Validate permissions and ownership on the server and in database policies.

## 5. Supabase SSR and Authentication

- Use the installed, compatible `@supabase/ssr` APIs and the repository's established cookie-handling pattern.
- Inspect existing middleware and Supabase clients before changing authentication.
- Keep browser and server Supabase clients separate.
- Ensure server-side cookie updates and refreshed sessions follow the supported SSR pattern.
- Treat middleware as a routing and session-refresh layer, not the sole authorization boundary.
- Verify the current user's identity and permissions in protected server operations.
- Enforce the required MFA assurance level for protected operations according to `supabase-rls-mfa`.
- Never use the service-role key as an ordinary browser or user-session credential.

## 6. API and Error Handling

- Validate request bodies, query parameters, route parameters, and uploaded data.
- Return consistent, non-sensitive errors with appropriate HTTP status codes.
- Never return stack traces, secrets, raw authentication tokens, or internal credentials to users.
- Apply timeouts and bounded input sizes to external requests.
- Keep provider-specific integrations behind small adapters.
- Make loading, empty, partial, error, and retry states explicit in the UI.

## 7. Configuration

- Keep secrets in the approved workspace secrets manager or local environment file excluded from Git.
- Maintain `.env.example` with variable names and safe placeholders only.
- Do not commit real API keys, service-role keys, session tokens, or production data.
- Verify the actual runtime and hosting constraints before selecting Node.js-only APIs or WebRTC infrastructure.

## 8. Verification

After changes, run the available project scripts for lint, type checking, tests, and production build. Inspect their real outputs.

For authentication changes, also test:

- Sign-in and sign-out.
- Session refresh.
- MFA challenges.
- Protected routes.
- Direct API access.

Do not claim a route is secure because middleware redirects unauthenticated users. Test the underlying server operation and database policies independently.