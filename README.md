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

Authentication uses an HTTP-only cookie (`access_token`). Set `JWT_SECRET` to a random value of at least 32 characters; the API intentionally has no fallback secret. Existing development accounts created with the former unversioned SHA-256 password format must be reset before they can sign in.

## Implemented API Endpoints (`/api/v1`)

- **Health**: `GET /health/live`, `GET /health/ready`
- **Auth**: `POST /auth/register/customer`, `POST /auth/register/merchant`, `POST /auth/consumer/login`, `POST /auth/merchant/login`, `POST /auth/admin/login`, `POST /auth/logout`
- **Users**: `GET /users/me`, `GET /users`, `GET /users/:id`, `POST /users`
- **Consumer Wallet**: `GET /wallet/overview`, `GET /wallet/transactions`, `POST /wallet/topup`
- **Consumer Orders & Payment**: `POST /consumer/orders/preview`, `POST /consumer/orders/pay`, `GET /consumer/orders`, `GET /consumer/orders/:id/receipt`
- **Consumer Quests, Points & Coupons**: `GET /consumer/quests` (alias `GET /quests`), `GET /consumer/points` (alias `GET /points`), `GET /consumer/coupons` (alias `GET /coupons`), `POST /consumer/coupons/:id/redeem` (alias `POST /coupons/:id/redeem`)
- **Merchant Catalog & Orders**: `GET /catalog/categories`, `POST /catalog/categories`, `GET /merchant/products`, `POST /merchant/products`, `PUT /merchant/products/:id`, `DELETE /merchant/products/:id`, `POST /merchant/orders`, `GET /merchant/orders`, `GET /merchant/orders/:id/receipt`
- **Admin Quests**: `POST /admin/quests/generate`

## Quality gates

Run `pnpm verify` before handing off a change. Database migrations require separate validation on an empty and representative upgraded database before deployment.

See `docs/REQUIREMENTS.md`, `docs/BUSINESS_RULES.md`, and `docs/ARCHITECTURE.md` before implementing product behavior.
