# ExecPlan Standard

An ExecPlan is a living implementation contract for complex work. It must be self-contained enough that another engineer or agent can continue safely without reconstructing hidden decisions.

## When an ExecPlan Is Required

Create an ExecPlan before implementation when any condition applies:

- The change affects more than five meaningful files across responsibilities.
- A PostgreSQL schema migration, data backfill, or staged rollout is required.
- Authentication, authorization, privacy, or security boundaries change.
- Wallet, payment, receipt, point, coupon, or quest invariants change.
- Multiple domain modules must coordinate in one business operation.
- A significant refactor changes ownership or dependency direction.
- Architecture, infrastructure, concurrency, or failure semantics change.
- The work requires multiple agents, phased delivery, or explicit handoffs.

Do not create an ExecPlan for a trivial rename, formatting-only change, local type/DTO addition, or a narrow fix with obvious verification.

## Storage and Naming

Store active plans under `.agent/plans/` using a stable kebab-case name such as `.agent/plans/qr-payment-idempotency.md`. Keep one plan per coherent outcome. Update the plan as facts change; do not maintain a second hidden plan only in chat.

## Required Structure

Every ExecPlan must contain:

1. **Outcome** - the observable user/business result.
2. **Requirements** - requirement IDs, acceptance criteria, and explicit non-goals.
3. **Current State** - relevant modules, contracts, schema, tests, and known constraints.
4. **Invariants and Risks** - security, authorization, value movement, concurrency, privacy, migration, compatibility, and failure-mode analysis.
5. **Decisions** - chosen design, rejected alternatives, and evidence/tradeoffs.
6. **Execution Steps** - ordered, independently verifiable tasks with owner role/level, files or boundaries, dependencies, and expected output.
7. **Verification** - targeted tests, integration/E2E coverage, static checks, security checks, migration validation, and acceptance evidence.
8. **Rollout and Recovery** - compatibility, feature flags if justified, migration order, monitoring, rollback/roll-forward, and data recovery.
9. **Progress Log** - timestamped completed steps, discoveries, deviations, and remaining work.
10. **Open Questions** - unresolved decisions and the authority/evidence required to close them.

## Execution Rules

- Keep only one step marked in progress per dependency chain; independent delegated steps may run in parallel.
- Assign concurrent agents non-overlapping files or clearly separated read-only investigations.
- Update the plan before implementing a materially different design.
- Record commands/checks actually run and their outcomes; never pre-mark verification as passed.
- Keep secrets, credentials, personal data, and raw production data out of plans.
- Close the plan with a requirement-to-evidence summary and any residual risk.
- An ExecPlan does not replace tests, ADRs, migrations, threat models, runbooks, or user approval for destructive/external actions.
