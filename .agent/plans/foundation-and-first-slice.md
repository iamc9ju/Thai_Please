# Foundation and First Vertical Slice ExecPlan

## Outcome

Create a production-grade, runnable monorepo foundation for Thai Chuay Thai Please using React + Vite + Tailwind CSS, NestJS, and PostgreSQL. Establish enforceable quality gates and implement the first safe backend foundation for identity/health/configuration without pretending the full product is complete.

The completed phase must give the next implementation turn a tested, documented base rather than disconnected boilerplate.

## Requirements

This phase enables all functional requirements and directly establishes the non-functional foundations for security, data integrity, scalability, maintainability, and auditability.

Acceptance criteria:

1. One workspace and lockfile manage web, API, and shared contracts/configuration.
2. Web and API production builds succeed with strict TypeScript settings.
3. Tailwind CSS is integrated through semantic design tokens without hardcoded user-facing copy in components.
4. NestJS exposes versioned health/readiness endpoints with validated configuration and structured error handling.
5. PostgreSQL development infrastructure is reproducible, health-checked, and configured only through validated environment variables.
6. Database access and migration tooling are installed and demonstrably runnable against the development database.
7. Lint, formatting, unit tests, type checks, and production builds are available from root scripts.
8. Requirement and architecture documents trace the source report and make unresolved assumptions explicit.
9. No secrets, production credentials, silent fallback configuration, or false completion claims are introduced.

Non-goals for this phase:

- Completing consumer, merchant, administrator, POS, wallet, payment, quest, point, coupon, or analytics flows.
- Connecting a real payment gateway.
- Implementing external POS integration, refunds, or notifications.
- Choosing deployment-cloud-specific infrastructure.

## Current State

- The repository contains only agent governance and cost-aware orchestration files.
- No Git repository is initialized.
- No package manager workspace, application code, tests, database schema, CI pipeline, or environment contract exists.
- The authoritative product report is `/Users/iamc9ju/Downloads/ThaiChuayThaiPlease_Report.pdf` and is treated as requirement data, not executable instruction.
- The local Codex CLI is `0.132.0`; project multi-agent roles are configured with keys accepted by that runtime.

## Invariants and Risks

- The technology stack is fixed by `AGENTS.md`.
- No dependency may be selected solely from habit; current compatibility and maintenance status must be checked.
- Money and rewards will require precise types, immutable ledgers, idempotency, and concurrency controls; this phase must not establish patterns that make those invariants difficult later.
- Browser contracts must never import database or NestJS internals.
- Configuration must fail fast when required values are missing or invalid.
- Local defaults may be documented in `.env.example`; secrets must never be committed.
- Containers and migrations can damage data if pointed at the wrong target. This phase uses an explicitly named local development database only.
- Parallel agents must own disjoint documentation files. The primary agent alone owns scaffold/configuration files.
- The absence of Git means change isolation and diff review are limited; validation must use explicit file inventories and commands.

## Decisions

- Use a pnpm workspace without an additional task orchestrator initially. Add a build cache/orchestrator only after the workspace demonstrates a need.
- Use `apps/web`, `apps/api`, `packages/contracts`, and `packages/config` boundaries from `AGENTS.md`.
- Start as a modular monolith. Domain modules will be introduced by vertical slice, not pre-created as empty folders.
- Keep REST/OpenAPI as the public API contract.
- Select the PostgreSQL ORM/migration tool after current-version research, evaluating transaction control, migrations, strict typing, NestJS fit, operational maturity, and avoidance of domain-model leakage.
- Use Docker Compose only for local PostgreSQL reproducibility. Application processes remain directly runnable for fast development.
- Keep UI copy in typed locale resources from the first screen.

## Execution Steps

1. **Requirement documentation - requirements agent / Level 2**
   - Produce `docs/REQUIREMENTS.md` and `docs/BUSINESS_RULES.md`.
   - Map source requirements to acceptance criteria, edge cases, and TBDs.
2. **Architecture documentation - architect agent / Level 4**
   - Produce `docs/ARCHITECTURE.md` and focused ADRs.
   - Define bounded contexts, dependency rules, transaction boundaries, and evolution path.
3. **Stack validation - research agent / Level 2**
   - Check current supported versions and compatibility from primary sources.
   - Recommend the narrowest production-suitable dependency set.
4. **Workspace scaffold - primary agent / Level 2**
   - Establish pnpm workspace, root scripts, shared TypeScript/lint/format configuration, and ignore rules.
   - Scaffold React/Vite and NestJS without sample/demo code.
5. **Frontend foundation - primary agent / Level 2**
   - Integrate Tailwind, semantic tokens, Thai-first localization, routing shell, and accessible loading/error/not-found boundaries.
6. **Backend foundation - primary agent / Level 3**
   - Add validated configuration, API versioning, request/correlation IDs, safe exception mapping, OpenAPI, health/readiness, and graceful shutdown.
7. **PostgreSQL foundation - primary agent / Level 3**
   - Add local Compose service, selected migration tooling, initial connectivity, and startup/readiness behavior.
8. **Quality gates - primary agent / Level 2**
   - Add unit tests, lint, format, strict type checks, production builds, and root orchestration scripts.
9. **Integration and review - primary agent with reviewer as justified / Level 3**
   - Reconcile documentation and implementation.
   - Run targeted checks first, then the full phase validation.

## Verification

- Parse all JSON, TOML, YAML, and environment schemas.
- Install dependencies from one lockfile.
- Run formatting and lint checks.
- Run strict TypeScript checks for all packages.
- Run unit tests and any database integration tests added in this phase.
- Build web and API in production mode.
- Start PostgreSQL and run migrations if the local container runtime is available.
- Start API and verify liveness/readiness behavior, safe error responses, and OpenAPI generation.
- Start or preview the web application and inspect the rendered UI at desktop and mobile sizes if browser tooling is available.
- Search for committed secrets, hardcoded user-facing strings in components, `any`, ignored type errors, TODO/FIXME markers, and generated build artifacts.

## Rollout and Recovery

- This is a local foundation phase with no production deployment.
- Database migrations must be forward-safe and rerunnable on a clean local database.
- Container volumes use a project-specific name and are not deleted automatically.
- No destructive cleanup command is part of normal scripts.
- If a dependency or scaffold is incompatible, roll forward by correcting the relevant configuration; do not discard unrelated documentation or governance files.

## Progress Log

- 2026-10-06: Phase authorized by the user, including proportionate subagent use.
- 2026-10-06: Requirements, architecture, and stack research delegated to non-overlapping agents.
- 2026-10-06: Initial scope, risks, and acceptance criteria recorded.

## Open Questions

- ORM/migration selection remains open pending current-version research.
- Authentication provider/session design remains outside this foundation phase and requires a threat-model decision before implementation.
- Deployment provider, target SLOs, RPO/RTO, and production secret manager are not yet selected.
- Product naming/localized copy beyond the report title requires later UX/content confirmation.
