# ADR-0001: Start with a modular monolith

- Status: Accepted
- Date: 2026-10-06
- Decision owners: Architecture and product engineering
- Requirements: `FR-C01`-`FR-C07`, `FR-M01`-`FR-M05`, `FR-S01`-`FR-S03`, `FR-A01`

## Context

The product connects POS, virtual-wallet payment, immutable receipts, quests, points, coupons, and analytics. Payment completion crosses several of these capabilities and requires strong consistency. The initial team, workload, service-level objectives, and independently deployable ownership boundaries are not yet established. Starting with distributed services would introduce network failure, cross-service consistency, deployment, observability, and operational costs without measured justification.

## Decision

Build one modular NestJS application and a separate worker composition root backed by one PostgreSQL system of record. Organize code and data ownership around explicit bounded contexts. Domain code remains framework-independent; controllers are adapters; repositories isolate persistence; contexts collaborate through application façades or versioned domain events and never write another context's tables.

The React/Vite web application consumes only versioned REST/OpenAPI contracts. API and worker processes remain stateless and can scale horizontally. Reliable asynchronous work uses a transactional PostgreSQL outbox plus idempotent handlers.

## Consequences

Benefits:

- value-moving workflows can use short local database transactions and constraints;
- one deployable reduces early operational and delivery complexity;
- module boundaries still enable focused ownership, testing, and later extraction;
- cross-context behavior is observable without a distributed trace being required for correctness.

Costs and risks:

- weak boundary enforcement could degrade into a tightly coupled monolith;
- API and worker share a release cadence even when their replica counts differ;
- a single primary database is an availability and write-scaling boundary;
- heavy analytics must be isolated from transactional paths as volume grows.

Mitigations include dependency-boundary linting/tests, one table owner per context, explicit façades/events, migration review, independent API/worker processes, query budgets, and operational telemetry.

## Alternatives considered

- **Microservices now:** rejected because no measured scaling, fault-isolation, regulatory, or team-ownership need offsets the added distributed-consistency and operations risk.
- **Unstructured layered monolith:** rejected because technical-layer folders do not protect domain ownership and make later extraction costly.
- **Serverless functions per capability:** rejected as a baseline because it fragments transaction ownership and introduces provider/runtime constraints without a requirement.

## Revisit triggers

Create a replacement ADR when a context has evidence of independently required scaling, fault isolation, release ownership, or regulatory separation. The proposal must define contract versioning, data ownership, consistency and failure semantics, migration/rollback, security, observability, and operating cost. High traffic alone is not sufficient if vertical or horizontal scaling of the existing process remains safe and economical.
