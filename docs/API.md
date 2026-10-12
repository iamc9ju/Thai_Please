# Backend API guide

The NestJS API is versioned under `/api/v1`. Swagger UI is available at `/api/docs` when `ENABLE_SWAGGER=true`. All money values are integer Thai baht with explicit currency `THB` for this prototype decision.

## Authentication

`POST /api/v1/auth/login` accepts only `{ "citizen_id": "13 digits" }` for an already provisioned user. There is no registration, email, or password endpoint. The response contains a short-lived opaque bearer token. Only its SHA-256 hash is stored.

Send protected requests with `Authorization: Bearer <token>`. Consumer resources are owner scoped; merchant mutations require an explicit merchant membership; the social-impact dashboard requires the administrator role.

## Idempotency

Value-moving mutations require an `Idempotency-Key` header containing 8-100 letters, digits, dots, underscores, colons, or hyphens:

- `POST /api/v1/wallet/topup`
- `POST /api/v1/orders/:id/pay`
- `POST /api/v1/coupons/:id/redeem`

Retry the same operation with the same key and identical request. Reusing a key for different input returns `IDEMPOTENCY_CONFLICT`.

## Endpoint summary

| Capability            | Endpoints                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity and overview | `POST /auth/login`, `GET /users/me`                                                                                                               |
| Wallet                | `GET /wallet`, `POST /wallet/topup`, `GET /wallet/transactions`, `GET /wallet/subsidy`                                                            |
| Merchant/catalog      | `GET /merchant-categories`, `GET /merchants`, `GET /merchants/:id`, `GET /product-categories`, `GET/POST /products`, `PATCH/DELETE /products/:id` |
| POS and orders        | `POST/GET /orders`, `GET /orders/:id`, `POST /orders/:id/items`, `DELETE /orders/:id/items/:itemId`, `POST /orders/:id/coupon`                    |
| QR and payment        | `POST /orders/:id/checkout`, `GET /payments/qr/:token`, `POST /orders/:id/pay`                                                                    |
| Receipt               | `GET /orders/:id/receipt`; successful receipts have no edit/delete/refund API                                                                     |
| Quest                 | `GET /quests`, `GET /quests/:id`, `POST /quests/generate`, `POST /quests/evaluate/:receiptId`                                                     |
| Point/coupon          | `GET /points`, `GET /coupons`, `POST /coupons/:id/redeem`                                                                                         |
| Dashboard             | `GET /merchant/dashboard?merchant_id=1`, `GET /dashboard/social-impact`                                                                           |

Errors use a stable envelope:

Applying an owned coupon occurs during consumer review after checkout. The request includes the current QR token; successful application recalculates the frozen final amount and rotates the QR token so an earlier undiscounted token cannot be paid.

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "Safe public message",
    "requestId": "correlation-id"
  },
  "path": "/api/v1/example",
  "timestamp": "UTC timestamp"
}
```

## Demo setup

Copy `.env.example` to `.env`, replace the database placeholder with a local PostgreSQL or Neon URL, then run:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate:deploy
pnpm --filter @thai-please/api db:seed
pnpm --filter @thai-please/api dev
```

Demo citizen IDs are created by the seed for consumer, merchant, and administrator journeys. They are development fixtures only and must not be used as production identity proofing.
