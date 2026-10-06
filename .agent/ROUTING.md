# Cost-Aware Model and Delegation Routing

This policy selects the least expensive reliable model, reasoning effort, context, and agent topology for each task. It never overrides `AGENTS.md`, product requirements, security controls, or runtime/user authorization.

## Routing Objective

Optimize cost per successfully verified task, not raw token count. Measure task success, regression rate, latency, total tokens, tool calls, retries, and review findings. A cheap attempt that produces rework or misses a critical defect is not cheaper.

Use these starting budget heuristics only for measurement, not as quotas:

- Luna: approximately 45% of delegated work.
- Terra: approximately 35%.
- Sol: approximately 15%.
- Astra: less than 5%.

Adjust only from observed task outcomes. Never force work onto a weaker model to satisfy a percentage.

## Level 1 - Mechanical

Preferred role: `cheap`

- Model: `gpt-5.6-luna`
- Reasoning: `low`
- Examples: symbol rename, formatting, DTO/type definitions, mapper, established CRUD pattern, boilerplate, narrow validation, simple unit tests from an existing pattern, lint/type fixes.

Stay at Level 1 only when behavior is unambiguous, scope is local, patterns already exist, and failure cannot compromise a critical invariant.

## Level 2 - Standard Engineering

Preferred role: `engineer`

- Model: `gpt-5.6-terra`
- Reasoning: `medium`
- Examples: service or repository implementation, API endpoint, frontend component/flow, API integration, normal refactor, ordinary database query, multi-rule validation, integration tests.

Escalate when the task requires a new architectural decision, has unclear cross-module ownership, or exposes a security/data-integrity risk.

## Level 3 - Complex Engineering

Preferred model: `gpt-5.6-sol`

- Reasoning: `medium` by default.
- Use `architect` with high reasoning for design decisions.
- Use `reviewer` with medium reasoning for independent risk review.
- Examples: complex business rules, transactions, concurrency, caching semantics, authentication, authorization, non-trivial migrations, performance diagnosis, difficult bugs, and cross-module refactoring.

## Level 4 - Critical or Architectural

Preferred role: `architect`

- Model: `gpt-5.6-sol`
- Reasoning: `high`
- Examples: system/security architecture, authorization model, wallet or ledger integrity, distributed coordination, race conditions, major migration/backfill, production incident root cause, or ambiguous requirements affecting many domains.

Use `escalation` (`gpt-6-astra`, high) only when at least one condition is documented:

1. A material architecture ambiguity remains after inspecting the authoritative requirements and existing decisions.
2. Sol-level implementation or diagnosis failed proportionate verification attempts and the root cause remains unclear.
3. Competing designs have high-impact security, financial, or data-integrity tradeoffs that cannot be resolved with available evidence.
4. The problem requires unusually broad cross-system synthesis and a wrong decision has material consequences.

Do not jump directly to Astra for routine implementation, boilerplate, broad repository exploration, or final review by habit.

## Escalation and De-escalation

Default escalation path:

`Luna low -> Terra medium -> Sol medium -> Sol high -> Astra high`

Escalation is evidence-driven, not prestige-driven. Record what is uncertain, what was tried, what evidence failed, and what the higher tier must decide.

After a complex decision is recorded, return straightforward DTOs, types, mappings, controllers, fixtures, and pattern-based tests to Luna or Terra. The architect should not spend budget on mechanical follow-through unless coupling makes separation unsafe.

## Delegation Decision

Use multiple agents when all are true:

- The task is substantial enough to offset coordination cost.
- It can be split into at least two concrete, bounded workstreams.
- The workstreams do not require concurrent edits to the same files or mutable state.
- Each workstream has an explicit output and verification method.
- Parallel execution or independent review materially improves latency or quality.

Prefer one agent when any are true:

- The task is small or can be completed in one short run.
- Each step depends directly on the previous step.
- Agents would contend over the same file, migration, or generated artifact.
- A fixed deterministic sequence is required.
- One slow external operation dominates elapsed time.

The primary agent must define ownership, dependencies, and integration order before delegation. Use no more than three concurrent spawned-agent threads unless the user explicitly approves a different budget. More agents are not automatically better.

The installed Codex CLI must select the named `cheap` role explicitly for low-cost delegated work. Its current project-config schema does not support repository-level scalar agent defaults or concurrency keys; do not add unsupported keys merely to imitate a default. If a future validated runtime supports those keys, they may set Luna/low and a concurrency limit of three after re-running config validation.

## Suggested Role Topology

For a complex feature, use only the roles that add value:

1. `architect`: define invariants, boundaries, transaction/concurrency decisions, acceptance criteria, and task decomposition.
2. `engineer`: implement cohesive services, repositories, API/UI integration, and integration tests.
3. `cheap`: implement isolated mechanical pieces that follow established decisions.
4. `reviewer`: independently review high-risk behavior and missing verification.
5. `escalation`: resolve only a documented Level 4 impasse.

Do not create every role for every feature. The primary agent synthesizes results, resolves conflicts against sources of truth, reviews the combined diff, and runs final verification.

## Context Loading Policy

Load the smallest context that can reliably answer the task:

1. Target files and applicable `AGENTS.md` files.
2. Directly imported interfaces and contracts.
3. One or two representative implementations.
4. Nearby tests and test utilities.
5. Relevant requirements, business rules, ADRs, and migrations.

Expand when imports, runtime behavior, test failures, authorization boundaries, or cross-module invariants require it. Do not scan unrelated modules for reassurance.

- DTO work should not inspect unrelated domains.
- Frontend work should use API contracts before backend internals.
- Backend work should inspect frontend code only when observable behavior or compatibility depends on it.
- Security, architecture, and incident tasks may require wider context, but the expansion must follow identified trust or dependency boundaries.

## Verification Economics

Run the smallest deterministic check that can fail for the current change, then widen based on risk:

`targeted test -> module tests -> typecheck -> lint -> integration/E2E -> broader suite`

Do not repeatedly run the entire suite after mechanical edits. Do run all required release gates before declaring a high-risk or release-ready change complete.

Review tier follows risk:

- Mechanical change: deterministic tools and targeted tests; add reviewer only if behavior changed.
- Standard feature: Terra-level self-review or independent review when the surface is broad.
- Business-critical logic: Sol reviewer.
- Security, authorization, ledger/payment, concurrency, or migration: Sol high; Astra only under the Level 4 escalation conditions.
