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
- **Merchant Catalog & Orders**: `GET /catalog/categories`, `POST /catalog/categories`, `GET /merchant/products` (supports `?includeInactive=true`), `POST /merchant/products`, `PUT /merchant/products/:id`, `PATCH /merchant/products/:id/status`, `DELETE /merchant/products/:id`, `POST /merchant/orders`, `GET /merchant/orders`, `GET /merchant/orders/:id/receipt`
- **Merchant Wallet, Withdrawal & Analytics**: `GET /merchant/wallet` (alias `GET /merchants/:id/wallet`), `GET /merchant/wallet/transactions` (alias `GET /merchants/:id/wallet/transactions`), `POST /merchant/wallet/withdrawals` (aliases `POST /merchant/wallet/withdraw`, `POST /merchants/:id/wallet/withdrawals`), `GET /merchant/dashboard` (alias `GET /merchants/:id/dashboard`)
- **Admin Portal & Social Impact**: `GET /admin/overview`, `GET /admin/merchants`, `POST /admin/merchants/:id/approve`, `POST /admin/merchants/:id/reject`, `POST /admin/merchants/:id/suspend`, `POST /admin/merchants/:id/activate`, `GET /admin/users/admins`, `POST /admin/users/:userId/roles/admin`, `PATCH /admin/users/:userId/roles/admin`, `GET /admin/subsidy-programs`, `POST /admin/subsidy-programs`, `PATCH /admin/subsidy-programs/:id`, `POST /admin/quests/generate`, `POST /admin/quests/generate-personalized`, `GET /admin/quest-generation-logs`, `GET /admin/rewards/monitoring`, `GET /admin/dashboard/social-impact`

## End-to-End (E2E) Acceptance Tests

Run the full-lifecycle HTTP acceptance test suite (`health.e2e-spec.ts`, `wallet-topup.e2e-spec.ts`, and 4-stage `platform-lifecycle.e2e-spec.ts`):

```bash
pnpm --filter @thai-please/api test:e2e
```

## Quality gates

Run `pnpm verify` before handing off a change. Database migrations require separate validation on an empty and representative upgraded database before deployment.

See `docs/REQUIREMENTS.md`, `docs/BUSINESS_RULES.md`, and `docs/ARCHITECTURE.md` before implementing product behavior.
