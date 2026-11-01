# Subsidy-program date overlap prevention

## Outcome

An administrator cannot create a subsidy program or move its dates into an inclusive period held by any other subsidy program. A program ending on one date permits the next program only from the following date.

## Requirements

The requested behaviour extends `FR-A04` (subsidy-program management) and formalizes `NFR-DATA-03`: date ranges must be unique across all program lifecycle states. Creation, date edits, inclusive boundaries, partial overlaps, containment, and concurrent writers are covered. Status-only edits are not blocked by legacy overlapping dates.

## Current state

`AdminService` owns create/update operations. `subsidy_programs` has DATE start/end fields but no range constraint. Existing historical data may already overlap, so an exclusion constraint cannot be deployed safely until that data is resolved.

## Invariants and risks

All date ranges are inclusive. Both the application and database serialize range writers. The database exclusion constraint protects direct SQL and concurrent writers; application validation gives the user a localized conflict before mutation. Existing overlaps are left unchanged. The migration must not be deployed until its documented query is reviewed.

## Decisions

Use PostgreSQL's GiST exclusion constraint over an inclusive `daterange`, which is authoritative for direct and concurrent writes. The migration deliberately stops if legacy rows overlap; it never silently changes historical data. Application checks use the same predicate (`new.start <= old.end AND new.end >= old.start`) under a transaction advisory lock to return a clear error before mutation.

## Execution and verification

1. Add a stable overlap code and localized conflict response.
2. Check overlap in create and date-changing update transactions.
3. Add a forward migration with preflight, recovery, and validation comments.
4. Test containment, partial overlap, shared bounds, adjacent dates, self exclusion, and status-only legacy updates.

Run `pnpm --filter @thai-please/api test -- src/admin/admin-operations.spec.ts src/common/filters/http-exception.filter.spec.ts`, API typecheck, and migration validation. Do not run migrations against Neon as part of implementation.

## Rollout and recovery

Before deploy, run the migration's pairwise-overlap query and resolve/report its results. Deploy readers and API validation first, then migration. If recovery is required, drop `subsidy_programs_date_overlap`; data is never rewritten. Monitor conflict responses under `ADMIN_PROGRAM_DATES_OVERLAP`.

## Progress log

2026-10-30: implemented application checks, database trigger migration, and regression tests. Migration has not been applied to a live database.

## Open questions

None. The explicit requested policy applies to every program status; future requirements can scope the policy to active programs only through a new migration and decision.

Final validation: 42 targeted tests passed; API production build passed. No live migration or real PostgreSQL concurrency test was executed. Migration deployment remains pending preflight for legacy overlaps.
