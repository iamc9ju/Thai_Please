# Admin portal theme

## Outcome

Present the existing authenticated admin portal in the same blue/white brand,
Anuphan typography, white navigation and rounded cards as the consumer portal.

## Requirements

FR-A01–FR-A07: retain all seven API-backed administration sections and actions.
Acceptance: branded responsive navigation, active section indication, keyboard
focus, refresh/logout, overview shortcuts, loading/error/empty feedback. Test
navigation, retry, forbidden response, empty list and existing merchant actions.
Do not mark the partial requirements complete or invent unsupported capabilities.

## Current State

AdminDashboard already connects to admin APIs. Existing tests cover overview,
merchant approval and social impact. ConsumerSidebar/ConsumerTopBar establish the
visual reference. REQUIREMENTS_CHECKLIST has unrelated user modifications.

## Invariants and Risks

Presentation only; no database, role policy, payment, ledger or permission changes.
Server remains authoritative for all mutations. Keep existing API contracts.
Preserve unrelated working-tree edits. Avoid showing a previous tab's action
feedback after navigation. Do not expose raw permission errors in page copy.

## Decisions

Use a dedicated admin shell with semantic theme tokens and the existing logo.
Desktop sidebar becomes a horizontally scrollable navigation on small screens,
so all sections remain accessible without a modal or focus trap.

## Execution Steps

1. Primary, Level 2: add localized shell copy and responsive admin shell.
2. Primary, Level 2: integrate existing sections, shortcuts and data-state feedback.
3. Primary: run targeted tests, web typecheck/lint/build and review diff.

## Verification

Passed: targeted admin tests (8), entire web suite (90 tests / 16 files), web typecheck, lint (existing warnings), production build and formatting of changed source files.
Existing backend behavior is outside this presentation change's verification.

## Rollout and Recovery

No migration or configuration change. Deploy ordinary web build; revert the
presentation changes to restore the previous shell. No persisted data changes.

## Progress Log

- 2026-10-27: Read administrator requirements, checklist and existing portal code.
  Confirmed existing implementation and documented partial backend requirements.

## Open Questions

None for presentation scope. Existing requirement gaps remain tracked in checklist.

- 2026-10-27: FR-A01–FR-A07 remain reachable through the branded shell; FR-A01 overview shortcuts, Bangkok timestamps and no-active-program state implemented. FR-A02 navigation/filter/action tests pass. Permission denial, retry, refresh and logout tests pass. All 90 web tests passed after rerunning outside the restricted environment because the first full run could not access test-runner temporary files.
- Existing admin API/type files have pre-existing formatting differences; unchanged. No browser screenshot or live database E2E was performed. Checklist retains Partial status and user edits.
