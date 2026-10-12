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
5. Apply migrations with `pnpm db:migrate:deploy`.
6. Load development fixtures with `pnpm --filter @thai-please/api db:seed`.
7. Run applications with `pnpm dev`.

The web application defaults to `http://localhost:5173`. The API defaults to `http://localhost:3000/api/v1`, with liveness at `/health/live` and database readiness at `/health/ready` under that versioned prefix.

## Quality gates

Run `pnpm verify` before handing off a change. Database migrations require separate validation on an empty and representative upgraded database before deployment.

See `docs/REQUIREMENTS.md`, `docs/BUSINESS_RULES.md`, and `docs/ARCHITECTURE.md` before implementing product behavior.

Backend endpoints, authentication, idempotency, Swagger, and seed instructions are documented in `docs/API.md`. The prototype decisions and security boundary are documented in `docs/PROTOTYPE_DECISIONS.md` and `docs/THREAT_MODEL.md`.
