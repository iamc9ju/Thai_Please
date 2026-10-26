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
2. Install dependencies with `corepack pnpm install --frozen-lockfile` after the first lockfile is committed; use `corepack pnpm install` only when intentionally updating dependencies.
3. Start PostgreSQL with `docker compose up -d postgres`.
4. Generate the Prisma client with `corepack pnpm db:generate`.
5. In VS Code, press `Ctrl+Shift+B` to start both applications.

### Run in VS Code

Open `D:\work\Thai_Please` as the VS Code workspace, then:

1. Press `Ctrl+Shift+B`.
2. Select `ThaiPlease: Dev (Web + API)` if VS Code asks which task to run.
3. VS Code starts Web and API in two dedicated, split Integrated Terminal panes. No external PowerShell window is opened.
4. Open the `Network` URL printed in the Web terminal from a phone connected to the same Wi-Fi.
5. Stop each process with `Ctrl+C` in its own terminal pane.

The individual `ThaiPlease: Web` and `ThaiPlease: API` tasks are also available through `Terminal` > `Run Task`. Do not run another development task while ports `5173` and `4000` are already in use.

The web application listens on all local interfaces and prints both its Local and Network URLs when it starts. A phone on the same Wi-Fi can open the Network URL, for example `http://192.168.1.37:5173`. The browser calls `/api` on the same origin and Vite proxies those requests to `http://localhost:4000`, so a LAN-specific API URL or CORS entry is not required. The API has liveness at `/health/live` and database readiness at `/health/ready` under its versioned prefix.

### Local HTTPS for phone camera access

Mobile browsers require a trusted secure context to access the camera. Generate a locally trusted certificate with `mkcert`:

```powershell
winget install FiloSottile.mkcert
powershell -ExecutionPolicy Bypass -File .\scripts\setup-dev-https.ps1
```

After generating the certificate, press `Ctrl+Shift+B` to start the applications. The setup script detects private LAN addresses and writes the key and certificate to the ignored `apps/web/certs` directory. Vite enables HTTPS automatically when both files exist and prints an `https://<LAN-IP>:5173` Network URL. If the computer's LAN IP changes, run the script again.

For phone camera access, copy `rootCA.pem` from the CA directory printed by the script to the phone and install it as a trusted CA certificate. Only install this development CA on devices you control. Opening the HTTPS URL without trusting that CA may show a certificate warning and may still leave camera access unavailable.

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
