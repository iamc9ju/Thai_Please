# Quest policy foundation

## Outcome and requirements

Create one editable, versioned policy and a strict domain parser for the proposed Gemini candidate-ranking workflow. Map FR-C07, FR-S01–FR-S06, BR-POINT-01/02, NFR-DATA-02 and NFR-TIME-01 from current REQUIREMENTS by capability. Acceptance: documented defaults, rejection of invalid/unknown values and contradictory limits, protected fixed invariants, meaningful tests. No database writes, Gemini calls, schedule activation or assignment implementation.

## Current state

Existing schema has quests/assignments/logs and financial records. The Gemini adapter document is a preview only. User authorizes choosing unspecified policy defaults. Current REQUIREMENTS numbering exceeds supplied AGENTS numbering; use capability names and current document IDs without renumbering. Preserve existing untracked docs/ai artifacts.

## Invariants and risks

One paid receipt after discounts; category snapshot; exclusive UTC expiry; transactional single reward. Configuration is not enforcement. Budget reservations, durable generation keys and historical policy snapshots require later implementation; do not claim these are delivered here. Exact rational multipliers avoid money floating point. No API key or PII enters policy.

## Decisions

Primary agent owns this bounded policy-only step. One JSON file owns adjustable defaults; domain schema validates it without filesystem/vendor coupling. Fixed invariants stay outside adjustable policy. Choose conservative one-active/one-daily-assignment limits, deterministic no-value fallback (defer), bounded catalog and point budgets. Document agent-selected defaults rather than claiming product requirements mandated them.

## Execution steps

1. Read requirements and conventions (complete).
2. Add JSON, parser, negative tests and Thai decision record.
3. Run targeted tests, TypeScript and diff review; record actual results.

## Verification

Tests cover committed policy, unknown fields, zero/oversized values, malformed ratios, budget contradictions and unsupported modes. Static types verify inferred contract. These checks do not prove runtime assignment, concurrency or reward safety.

## Rollout and recovery

No module consumes policy yet. Future consumer loads and validates before use; records version/snapshot per assignment and reserves budgets transactionally. Revert only new policy artifacts if needed; no data recovery required.

## Progress

2026-10-16: Requirements inspected; JSON policy, strict Zod parser, Thai decision record and 8 tests complete. Targeted Vitest: 1 file / 8 tests passed. API `tsc --noEmit --pretty false`: exit 0. Prettier formatted all five new files. Initial sandbox pnpm access denied; approved escalated commands succeeded. Runtime integration and financial/assignment enforcement are explicitly not delivered in this policy step.

## Open questions

None blocking policy defaults: user delegated these choices. Existing generation logs and full invariant enforcement remain later work. AI provider/model/key belong in validated environment configuration, not policy.
