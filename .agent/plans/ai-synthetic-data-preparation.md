# ExecPlan: AI synthetic data preparation (roadmap Step 3)

## Outcome

Generate reproducible SYNTHETIC purchase/assignment history and a validated CSV of finalized assignments using the Step 2 feature contract. Keep raw history for a later development DB adapter. No DB connection, seeding, training, prediction API, or financial/reward mutations.

## Requirements and acceptance

- FR-S01: all 20 features match documented windows, exact amounts, distinct orders and cutoff.
- FR-C07/FR-S06: labels come from one owned PAID order in validity; no receipt aggregation or subsidy deduction.
- FR-S03: validated raw/config boundaries, allow-listed quest types and consistent catalog references.
- FR-S04/NFR-OBS-01: provenance, versions, seed, hashes, outcome and feature timestamps retained.
- NFR-DATA-02/NFR-TIME-01: integer minor units/Decimal; timezone-aware UTC; exclusive expiry.
- Output includes both labels and all four quest types; active assignments remain in raw history but not supervised CSV.
- Targeted tests include leakage, boundaries, discount allocation, malformed raw data and deterministic reruns.

## Current state

Python 3.14.3 venv/dependencies exist. docs/ai defines schema/features. No generator or feature implementation exists. Working tree has user-authorized document changes; preserve them.

## Invariants and risks

No synthetic metric claims real performance. No PII, credentials, wallet balances, rewards or DB writes. Use receipt snapshots for category facts. Validation must fail on inconsistent outcomes or pricing rather than silently repair. Pending/active are not failures. Schema deficiencies remain integration work.

## Decisions

CPU offline Python with existing Pydantic/pytest, standard-library JSON/CSV/Decimal/random. Config values are named demo fixture parameters, not business defaults. Use non-overlapping assignments per synthetic user so unresolved multiple-assignment reward policy is not chosen. Product quests are product-only. Actual outcome calculated from purchase timeline, not randomly assigned. Raw file preserves logical IDs, immutable quest/item snapshots and known-at timestamps. No mock ledger posting: raw PAID history is an analytical fixture, not directly seedable financial records; future DB adapter must create consistent ledgers.

## Execution steps

1. Primary owns validated models/constants/config plus money/rule functions.
2. Primary owns feature extraction, configurable generator and prepare CLI.
3. Primary owns negative/boundary/property tests and generates reviewed artifacts.
4. Primary updates README, dataset metadata and roadmap progress after checks pass.

## Verification

Run venv pytest with bytecode disabled, compile syntax check if needed, CLI generation, validated reload, reproducibility comparison in temporary directories, output class/type/null/range checks, hash/provenance inspection, docs formatting and git diff check. No claim of DB parity until a real adapter is tested.

## Rollout and recovery

Local-only generated fixtures under ai-service/data. Refuse overwriting different existing outputs unless explicitly requested; same bytes may be reused. Config and code versions pin provenance. No schema or runtime release. Roll back code/docs by reviewed diff; never delete user files.

## Progress

- 2026-10-14: Step 3 authorized; inspected docs, Prisma, venv and working tree.
- Implemented validated contracts/config, integer allocation oracle, features, generator and CLI without network/DB access.
- Ran `python -B prepare_data.py`: 60 users, 2,228 paid orders, 540 assignments, 496 rows (171 positive/325 negative), 44 active excluded.
- First pytest run: 22 passed, one setup error due sandbox temporary-directory permissions. Approved rerun outside sandbox: all 23 passed. Added catalog/config/snapshot coverage; final pytest: 25 passed in 4.15 seconds.
- Test verifies re-generation and JSON reload reproduce output bytes. CLI `--raw data/raw_history.json --output .pytest_cache/revalidated` succeeded with original hashes.
- Documentation updated; model training, production reward engine and DB parity explicitly remain unimplemented.
- Final checks: parsed all 7 Python files with AST; all 3 artifact hashes match manifest; each quest type has both classes; CSV row count is 496. Targeted Prettier checks and git diff whitespace check passed. Step 3 complete for offline preparation.

## Requirement-to-evidence summary

FR-S01: window/cutoff/target distinct-order/null/history denominator tests. FR-C07/FR-S06: four rule types, single proof, validity, post-discount/category/subsidy tests. FR-S03: strict schemas, duplicate/dangling/tampered records and unsupported mixed quests rejected. FR-S04/NFR-OBS-01: manifest/provenance/snapshots, both labels/type coverage, raw revalidation and deterministic hashes. NFR-DATA-02/NFR-TIME-01: integer/Decimal allocation, UTC validation and time boundaries. Offline/DB parity not claimed.

## Open questions

Simultaneous assignments and point expiry remain backend-policy decisions. Fixture avoids overlapping assignments and does not issue points. Dataset sizes/scenarios are replaceable fixture configuration. Model training and development DB seed remain later work.
