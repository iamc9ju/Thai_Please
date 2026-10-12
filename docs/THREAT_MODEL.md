# Prototype authentication and QR payment threat model

## Scope and assets

This model covers citizen-ID prototype login, bearer sessions, merchant POS orders, opaque QR payment intents, virtual wallet/subsidy value, coupons, quest rewards, immutable receipts, and administrator analytics. It does not claim production identity assurance or regulatory compliance.

Protected assets are citizen identifiers, bearer and QR tokens, wallet/point value, coupon ownership, merchant membership, immutable receipt facts, policy/audit records, and database credentials.

## Trust boundaries

- Browser or POS client to the NestJS API over TLS.
- NestJS API to PostgreSQL through parameterized Prisma queries.
- Quest proposal provider to the deterministic schema/policy and rule-engine boundary.
- Administrator and merchant roles to owner-scoped application operations.

## Primary threats and controls

| Threat                                 | Required controls in this implementation                                                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Citizen ID disclosure or impersonation | Citizen ID is accepted only at login, excluded from tokens/logs, and mapped to an opaque expiring session. Citizen-ID-only login is prototype-only and not production identity proofing. |
| Bearer theft/replay                    | High-entropy opaque tokens, hash-only storage, UTC expiry, revocation field, TLS requirement, and no token logging.                                                                      |
| QR guessing/tampering/replay           | High-entropy opaque token, hash-only storage, one intent binding, frozen server-side snapshot, expiry check, terminal-state check, and idempotent payment.                               |
| Client total/price manipulation        | Product, quantity, discount, and final total are resolved/recalculated server-side; payment uses the frozen database snapshot.                                                           |
| Double debit or response-loss retry    | Scoped idempotency record, canonical request hash, unique ledger/receipt/payment references, serializable transaction, and row locks.                                                    |
| Concurrent overspend                   | Wallet row lock, non-negative database constraint, conditional balance update, and ledger/projection commit in the same transaction.                                                     |
| Coupon double-use/cross-account use    | Owner/status/expiry checks, row lock, unique used-order relationship, and consumption inside the payment transaction.                                                                    |
| Duplicate quest reward                 | Deterministic receipt facts, conditional assignment transition, unique reward business reference, and atomic point ledger/allocation write.                                              |
| Receipt/ledger tampering               | PostgreSQL foreign keys/checks plus update/delete prevention triggers for successful receipts and value ledgers.                                                                         |
| Cross-account/merchant enumeration     | Owner and merchant-membership checks return generic not-found/forbidden responses and never trust UI visibility.                                                                         |
| Secret leakage                         | Placeholder-only `.env.example`, startup validation, safe exception mapping, and no credential/token/QR logging.                                                                         |

## Residual risks and required production decisions

Citizen-ID-only authentication has weak identity assurance and is authorized only for this prototype. Production deployment requires approved identity proofing, recovery, session revocation operations, rate limiting, brute-force monitoring, CSRF strategy if cookies replace bearer headers, retention/deletion policy, administrator provisioning, and a secret manager. QR and payment endpoints require TLS and deployment-level abuse controls. These items remain blockers for a production security claim.
