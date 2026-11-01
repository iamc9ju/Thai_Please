# Admin portal operations

## Scope and requirement traceability

This change covers non-account administrator operations. The user explicitly
excluded identity creation, user passwords, password reset and account changes.
Existing account management is retained without changes.

| Requirement     | Supported operations                                                                                          | Verification                               |
| --------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| FR-A01          | API overview, Bangkok update time, refresh/retry, stale request protection                                    | AdminDashboard tests                       |
| FR-A02 / FR-M01 | Merchant status filters/actions; merchant product API rejects inactive stores                                 | Admin and catalog unit tests               |
| FR-A04          | Create program, edit details, activate/deactivate; protect used policy                                        | Program editor and admin enhancement tests |
| FR-A05          | Select individual consumer, filter to no-active-quest consumers, inspect stored rules/evidence and provenance | Quest details and admin enhancement tests  |
| FR-A06          | Assignment, point and coupon histories, completion/use/expiry dates and empty states                          | Admin monitoring tests                     |
| FR-A07          | All-time metrics/rankings, explicitly labelled trend period, 7/14/30-day trends                               | Dashboard/API tests                        |

## Program policy

Prototype amounts are integer baht. Supported currency is THB and the business
calendar is Asia/Bangkok; these are explicit supported values, not general FX or
multi-timezone support. The dates are calendar dates persisted as PostgreSQL DATE.

For an unused program, an administrator can edit its name, grant, co-payment
percentage, daily cap and dates. A referenced program's economic terms must not be
rewritten; create a new program for revised terms. Existing orders/receipts and
ledger entries are never updated by program editing. Lifecycle activation and
deactivation are separate controls. The backend validates policy even if the
frontend form is bypassed.

`PATCH /api/v1/admin/subsidy-programs/:id` accepts the existing create fields as
optional updates (programName, initialGrant, subsidyPercentage, dailySubsidyLimit,
startDate, endDate, status) plus supported currency/timezone. Unsupported values
and reversed dates are rejected. No migration or data backfill is required.

## Generation diagnostics

`GET /api/v1/admin/quest-generation-logs` retains existing fields and adds
allowlisted `proposal`, `candidates` and `validationResult`. Missing historical
provider/model/prompt/policy values remain null and the UI displays that they
were not recorded. A saved assigned rule is evidence of an assignment, not a
fabricated independent validation report. Personal inputSummary, raw prompts and
unrestricted policy/provider payloads are not returned by the new diagnostics.

The consumer cohort selector is a filter before individual generation, not a
bulk AI job. Generation continues using the existing per-user endpoint and
idempotency key. Durable segment batch jobs require an approved job workflow and
are outside this change. Failure/legacy records without saved evidence are
explicitly shown as having no recorded validation.

## Monitoring interpretation

Headlines and rankings are cumulative; the period buttons select only the daily
trend. Expired resources are presented according to stored status and explicit
expiry boundaries. Cancelled quest assignments must not be counted as active.
Category item sales remain item-line totals before order-level discounts; they
must not be interpreted as net settlement by category.

## Security and recovery

Only authenticated ADMIN sessions use admin endpoints. Merchant suspension is
scoped to the merchant, preserving unrelated consumer accounts. Inactive stores
cannot access the merchant product-management API. No credential flows are added.

The change is additive at the API response level and has no schema migration.
Deploy API and web together for diagnostic details; older logs remain readable.
Keep immutable historical records when rolling back UI changes. Existing audit
implementation uses structured server logs; durable database audit storage and
replayable outbox delivery are not introduced or claimed here.

## Validation limits

Unit/component tests and HTTP E2E use controlled fixtures. Production database
mutations or credential changes are not part of development verification. The
requirements checklist remains Partial until its database-backed E2E and other
recorded gaps are resolved.

## FR-A06 compatibility fix (2026-10-28)

The live read-only check reproduced Prisma P2022 for
`user_quests.cancelled_at`. Monitoring had requested every scalar through
`include`, including through the point transaction source relation. The report
does not use cancellation metadata. Its queries now select only transport fields
and source names, with stable ID tie-breakers for equally dated records. This
avoids coupling the report to unrelated quest/AI migrations without modifying
schema or historical data. AI and account/password work remain paused.

Validation: API admin tests 20 passed; admin page tests 13 passed; API and web
production builds passed. The same read-only database request subsequently
returned its summary and all three history collections successfully. This is
real database read evidence, not mutation/concurrency E2E coverage.

## Merchant search, type and confirmations (2026-10-28)

FR-A02/FR-M01: approve and reject now open a native modal dialog before any
mutation. Cancel/Escape closes without an API call; submit is guarded against
repeated clicks. Pending view offers Approve All for the visible list after search
and type filters. The dialog lists the exact snapshot and count. Stores arriving
later are excluded. Calls execute sequentially using existing individual audited
transactions; partial failure is reported and the list refreshed. No batch atomic
success is implied. Each confirmed call sends optional expectedStatus; the API
checks it under the merchant lock and returns 409 on a changed state, before any
wallet/role write. Older API clients may omit this additive field.

Search matches store/owner names, phones and addresses, combined with store status
and type. The type selector uses registration choices plus stored legacy values
and a separate unknown choice. Registration previously discarded merchantType.
The additive nullable merchant_type VARCHAR(100) migration now preserves it.
Existing stores remain null; there is no guessed backfill or password/account-role
change. New registrations store their selected type and admin responses return it.

Migration 20261028090000_add_merchant_type was executed and marked applied alone;
pending AI migrations were not run. Live information_schema verification confirmed
VARCHAR(100), nullable YES; the pending merchant list was readable with type fields.
Deploy this column before API code. Rollback readers first and retain the nullable
column to preserve collected values. No index/backfill/table rewrite; five-second
lock timeout. Validation: SELECT data_type,is_nullable,character_maximum_length
FROM information_schema.columns WHERE table_schema='public' AND
table_name='merchants' AND column_name='merchant_type'.

Verification: 18 admin page tests, 22 admin API tests, four HTTP E2E tests passed;
API/web production builds passed and lint passed with existing frontend warnings.
No real merchant approvals/rejections were performed as part of verification.
