---
name: supabase-rls-mfa
description: Implement and verify Supabase authentication, TOTP MFA, AAL2 enforcement, owner-based row-level security, invite-token isolation, and multi-account security tests. Use for all authentication, schema, migration, database access, and authorization changes.
---

# Supabase RLS and MFA

## Purpose

Establish a consistent security foundation for the hackathon application. Every table, route, and protected operation must preserve tenant isolation and enforce the security requirements in `SPEC.md`.

## 1. Inspect Before Implementing

Before changing the database or authentication:

1. Read the relevant schema and security requirements in `SPEC.md`.
2. Inspect existing Supabase migrations, generated database types, clients, middleware, and authentication routes.
3. Identify all eight required tables and their relationships.
4. Determine which tables are user-owned, which are related records, and how `session_invites` must be scoped.
5. Preserve existing working migrations and conventions. Do not silently replace established schema.
6. Do not invent missing table names, columns, constraints, or product behavior. Resolve them from `SPEC.md` and the existing repository.

## 2. Database Schema and Migrations

- Use version-controlled SQL migrations as the source of truth for database changes.
- Give each user-owned table an appropriate `owner_id` referencing the authenticated user.
- Use suitable foreign keys, unique constraints, check constraints, indexes, and deletion behavior.
- Use appropriate timestamps and status constraints where required.
- Keep ownership consistent across related records.
- Use transactions where appropriate for multi-step database operations.
- Regenerate or update database types when the project's tooling supports it.
- Do not rely on application code alone to enforce database invariants.
- Before writing policies, document the ownership relationship for each table.

## 3. Row-Level Security (RLS)

Enable RLS on every exposed application table.

### Required Policy Review

For each table, explicitly determine the permitted roles and conditions for:

- `SELECT`
- `INSERT`
- `UPDATE`
- `DELETE`

### User-Owned Rows

- Require the authenticated identity to match the row's `owner_id`.
- On `INSERT`, ensure the caller cannot assign another user's owner ID.
- On `UPDATE`, constrain both the existing row and the resulting row to the authorized owner.
- On `DELETE`, ensure the caller owns the row.
- Check related-record ownership where a child row references a parent row.
- Avoid policies that accidentally grant access through broad `OR` conditions.
- Remember that permissive PostgreSQL policies can combine in ways that broaden access.
- Do not assume a policy on a parent table automatically protects its child tables.

### Special Handling for Session Invites

Follow the exact `session_invites` design in `SPEC.md`.

- Store invite tokens as cryptographic hashes, not reusable raw bearer tokens.
- Enforce expiration and single-session scope.
- Do not expose other sessions or unrelated lead records to invite holders.
- Permit the minimum access necessary to join the invited session.
- Ensure invite access cannot bypass the session's owner and purpose constraints.
- Never authorize a request solely because a client submits a session ID or invite ID.

If anonymous or unauthenticated invite joining is required:

- Implement an explicit, narrowly scoped authorization flow.
- Do not grant broad anonymous table access to make the feature work.

## 4. Authentication and TOTP MFA

Use Supabase Auth's supported MFA APIs instead of implementing TOTP cryptography from scratch.

### Implement and Test

- Sign-up, sign-in, and sign-out.
- TOTP enrollment and QR-code presentation.
- Verification of the enrollment challenge before considering MFA enrolled.
- Sign-in MFA challenge and verification.
- Session refresh and recovery behavior.
- Clear handling of invalid codes, expired challenges, and unavailable services.

### MFA Verification Rules

- Use the actual assurance level returned by Supabase.
- Do not infer MFA completion from the presence of a user session or an enrolled factor alone.

## 5. AAL2 Enforcement

The protected application requires the assurance level specified in `SPEC.md`.

- Check the current session's assurance level using the supported Supabase API.
- Require AAL2 on protected routes and sensitive server operations.
- Treat middleware redirects as a usability layer, not the sole security control.
- Enforce authorization at the server operation and database policy boundaries.
- Do not permit an AAL1 session to perform protected writes merely because a page was loaded previously.
- Handle session refresh and step-up MFA transitions correctly.
- Avoid redirect loops between the sign-in page, MFA challenge, and protected routes.

### Database-Level Enforcement

Where database-level assurance restrictions are needed:

- Verify the current Supabase-supported policy pattern.
- Apply it to the appropriate operations.
- Do not invent authentication claims or rely on stale session data.

## 6. Privileged Credentials

- Never expose the Supabase service-role key to the browser.
- Never use privileged credentials for ordinary user-scoped queries when an authenticated client is sufficient.
- Keep privileged operations in isolated server-only modules.
- If a privileged operation is unavoidable, explicitly validate identity, ownership, authorization, and input before executing it.
- Ensure privileged operations do not accidentally bypass the ownership checks enforced by RLS.
- Never log secrets, access tokens, raw invite tokens, or MFA codes.

## 7. Two-Account Isolation Tests

Use two independent test users, A and B, with separate sessions.

### Required Test Cases

Verify that:

1. A can access A's permitted records.
2. B can access B's permitted records.
3. A cannot read B's records.
4. B cannot read A's records.
5. Neither user can update or delete the other's records.
6. Neither user can insert a record with another user's `owner_id`.
7. Changing URL IDs, request bodies, or query parameters does not bypass authorization.
8. Direct Supabase API requests are blocked when unauthorized.
9. Related records cannot be accessed through a permitted parent or child relationship.
10. Invite tokens cannot expose unrelated sessions or be reused outside their allowed scope.
11. Protected operations reject insufficient MFA assurance.
12. Any special `session_invites` access is limited to the intended session and operations.

### Test Execution Requirements

- Run these tests against the actual policies, not only mocked application functions.
- Use a local or dedicated test project and synthetic data.
- Inspect the actual test output and report any failures or unverified cases.

## 8. Security Acceptance Criteria

Do not mark the security foundation complete until:

- [ ] All eight tables have been accounted for.
- [ ] RLS is enabled and policies have been reviewed for each exposed table.
- [ ] Ownership checks cover inserts, updates, deletes, and reads as applicable.
- [ ] TOTP enrollment and challenge verification work.
- [ ] AAL2 enforcement works for protected operations.
- [ ] The two-account isolation tests pass.
- [ ] The application does not expose privileged credentials.
- [ ] Migration and test output has been inspected.
- [ ] Any unresolved security limitations are reported explicitly.

## Final Security Rule

Never weaken RLS, disable MFA, or skip isolation tests just to meet a deadline.

Report blockers and use the hackathon's documented feature cut order instead.