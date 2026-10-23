---
name: verify-before-done
description: Verify every implementation task with real checks, inspect actual command output, and never claim unverified work is complete. Use after every code change and before marking any hackathon task done.
---

# Verify Before Done

## Purpose

Prevent unverified code, invented test results, scope creep, and premature completion. Every task must be supported by evidence.

## Mandatory Workflow

For every task:

1. Read the relevant requirement in `SPEC.md`, the applicable instructions in `AGENTS.md`, and the relevant skill files.
2. Inspect only the files and dependencies needed for the task.
3. State the intended change and the acceptance criteria briefly.
4. Implement the smallest change that satisfies the requirement.
5. Run the narrowest relevant test.
6. Run the applicable project checks:
   - Lint.
   - TypeScript type checking.
   - Production build.
   - Relevant unit, integration, security, or end-to-end tests.
7. Inspect the actual command output and fix failures introduced by the change.
8. Review the diff for unrelated edits, secrets, debug code, and accidental deletions.
9. Report what changed, which checks ran, their actual results, and any remaining risks.
10. Commit only when the task is verified and repository instructions permit committing.

## Truthfulness Requirements

- Never claim a command passed unless it was actually executed and its result inspected.
- Never describe an unrun test as passing.
- Distinguish between passed, failed, blocked, and not run.
- If a command cannot run, state why and provide the next best verification step.
- Do not suppress errors or weaken tests merely to obtain a passing result.
- Do not assume a successful build proves application behavior or security.
- Never fabricate logs, screenshots, test counts, deployment status, or commit hashes.

## Scope Control

- Implement one task or a small, tightly related set of changes per session.
- Avoid unrelated refactoring, dependency upgrades, and speculative features.
- Reuse existing types, schemas, utilities, and conventions where appropriate.
- Do not rewrite working code without a requirement or a demonstrated defect.
- Ask one focused question if a missing decision materially affects security, architecture, or acceptance criteria. Otherwise, follow established project conventions.

## Hackathon Constraints

- Preserve the requirements and priority order in `SPEC.md`.
- Optimize total token usage by inspecting targeted files and producing focused diffs.
- Use fixture data for UI development whenever live model calls are unnecessary.
- Never replace real acceptance criteria with mocks. Fixtures accelerate UI work but do not prove production integrations work.
- Do not mark a task complete merely because its UI renders.

## Definition of Done

A task is complete only when:

- Its acceptance criteria are satisfied.
- Its relevant checks have been executed and their results inspected.
- No known critical regression remains.
- Security-sensitive behavior has appropriate tests.
- The final report accurately describes verification and limitations.

## Required Response Format

### Implemented

Concise description of the changes made.

### Verification

Commands executed and their actual outcomes.

### Not Verified

Checks not run, external dependencies unavailable, or unresolved risks.

### Next Task

The next smallest dependency-safe task.

If nothing remains, state that explicitly. Never claim the entire project is complete based on a single successful check.