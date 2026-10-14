# Thai Chuay Thai Please

Production-oriented foundation for an AI-powered local-spending, personalized-quest, and gamification platform.

## Stack

- React 19 + Vite 8 + Tailwind CSS 4
- NestJS 12
- PostgreSQL 18 + Prisma ORM 7
- TypeScript 6 + pnpm workspaces

## Prerequisites

- Node.js 24.15 or newer (Node 24 LTS is the production baseline)
- pnpm 12.9.1
- Docker with Compose for local PostgreSQL

## Local setup

1. Copy `.env.example` to `.env` and replace every `replace-me` value.
2. Install dependencies with `pnpm install --frozen-lockfile` after the first lockfile is committed; use `pnpm install` only when intentionally updating dependencies.
3. Start PostgreSQL with `docker compose up -d postgres`.
4. Generate the Prisma client with `pnpm db:generate`.
5. Run applications with `pnpm dev`.

The web application defaults to `http://localhost:5173`. The API defaults to `http://localhost:4000/api/v1`, with liveness at `/health/live` and database readiness at `/health/ready` under that versioned prefix.

Authentication uses an HTTP-only cookie. Set `JWT_SECRET` to a random value of at least 32 characters; the API intentionally has no fallback secret. Existing development accounts created with the former unversioned SHA-256 password format must be reset before they can sign in.

## Quality gates

Run `pnpm verify` before handing off a change. Database migrations require separate validation on an empty and representative upgraded database before deployment.

See `docs/REQUIREMENTS.md`, `docs/BUSINESS_RULES.md`, and `docs/ARCHITECTURE.md` before implementing product behavior.

## AI implementation plan

See the [main AI plan](AI_IMPLEMENTATION_PLAN.md), [Thai AI plan](AI_IMPLEMENTATION_PLAN_THAI.md), and [beginner execution roadmap and progress](docs/AI_BEGINNER_ROADMAP_TH.md).

Roadmap Steps 1–3 are complete: tooling, data/feature design and offline synthetic preparation. See the [dataset schema](docs/ai/DATASET_SCHEMA.md), [feature definitions](docs/ai/FEATURE_DEFINITIONS.md) and [AI preparation commands](ai-service/README.md). The academic fixture has 496 finalized training rows and 25 passing tests. Next is CatBoost training; no trained model, recommendation API or DB seed has been implemented.
