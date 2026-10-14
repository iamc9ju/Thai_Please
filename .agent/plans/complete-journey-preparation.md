# ExecPlan: Complete Journey preparation (Steps 2–3)

## Outcome

Update the AI plan and produce a reproducible pilot CSV from the audited Complete Journey files. One sample is household + UTC cutoff + candidate template. Finish before training: no model, scoring API, NestJS implementation, DB connection, schema change, seed, payment, or reward mutation.

## Requirements and acceptance

- FR-C07 / FR-S01–FR-S03: retain four candidate quest types and strict candidate/feature contracts; use observed purchase features, never fabricated quest history.
- FR-S06 / NFR-DATA-02 / NFR-TIME-01: a proxy label needs one matching basket in `[cutoff, expires_at)`, exact cent calculations, normalized threshold relative to the historical whole-basket mean. This is an analytical predicate, not production completion evidence.
- FR-S04: source hashes, policy/schema versions, selection seed, sample identities, cutoff, label evidence and exclusions must be reproducible.
- Pilot: up to 200 households × 4 cutoffs × 4 candidates = 3,200 rows before exclusions, with both classes and all types or an explicit diagnostic failure.
- Old synthetic fixtures and tests remain intact and separate. No Step 4 training or model metrics.

## Current state

Steps 1–3 previously completed for synthetic-v1 (20 features, 496 finalized assignment rows). Training and production integration have not started. Audited full source has 1,469,307 lines, 155,848 baskets and 2,469 households. Downloaded pinned R files and isolated pyreadr reader exist locally. Working tree already contains audit artifacts and ignore edits; preserve them.

## Invariants and risks

No label is an actual quest outcome; no incentive or reward effect is learned. Currency is not converted. Source `sales_value` has retailer-revenue semantics, not confirmed platform net-payable semantics. Raw source IDs are audit/target metadata, not cross-platform categorical predictors. No PII or demographics are needed. Do not partially trim a basket and misrepresent the remaining total as its receipt amount. Training rows share histories; later chronological evaluation must purge overlapping outcome windows.

## Decisions

- 2026-10-15 user chose relative spending targets rather than fixed currency amounts and a pilot first, not the full ~80,000 sample set.
- Preserve CatBoost and the four template types. Use versioned, implementation-neutral JSON for template mechanics. Relative multipliers 1.0 / 1.5 and duration 7 days are pilot experiment settings, not an approved production reward/eligibility policy.
- Features v2 use existing purchase counts, target purchase counts, type, duration and required-spend/average ratio. Exclude five quest-history features, reward, raw money/gap and raw target identities: absent outcomes, no incentive response data and currency/catalog mismatch respectively. Keep actual target, threshold, source amount and proof in metadata.
- Source preparation and shared pure calculations operate on observed baskets, not synthetic PAID orders. Reject affected baskets as a whole when line integrity fails. Mark observation intervals affected by rejected baskets as censored rather than manufacturing negative labels. Dataset source removal of Christmas Day must be treated as a known observation gap.
- Sampling/candidate selection uses only pre-cutoff history plus a deterministic seed; never choose a target or threshold by inspecting future purchases. New/unknown targets are selected from the catalog observed strictly before cutoff, avoiding future-catalog leakage.

## Execution steps

1. Complete: Primary (Level 3) owns feature/label/policy design, this plan and requirement mapping.
2. Complete: versioned policy, normalized basket contracts and source adapter; no legacy domain edits.
3. Complete: preparation CLI, pilot sampling, labels, features, provenance and meaningful tests.
4. Complete: English/Thai plans, roadmap, current contract and README; separate pilot outputs.
5. Complete: 50 tests, independent original-source proofs, artifact hashes, unchanged legacy hashes, byte-identical full-source regeneration, formatting and diff checks. No training.

## Verification

Use narrow venv tests first. Exercise amount ratios and rounding, no multi-basket accumulation, category totals, product presence, store target, inclusive history lower/exclusive upper bounds, exclusive expiry, missing/censored periods, future-independent candidate generation and deterministic output. Then run all offline preparation tests. Validate full-file normalization and pilot counts. Run formatting/AST/diff checks. Model quality and DB parity are not measured.

## Rollout and recovery

New data/feature/policy versions and output directory coexist with synthetic-v1. Refuse unapproved overwrites. Source normalization cache is ignored local audit material; reviewed pilot CSV and manifest are separate from raw downloads. No migrations or deployed behavior. Changing proxy targets into genuine assigned-quest outcomes requires a new documented dataset/model version.

## Progress log

- 2026-10-15: Read all 17 original AI plan sections, feature/schema docs, policy/generator and audit; inspected current tree.
- 2026-10-15: User explicitly approved relative targets and pilot-first preparation; clarified today stops before Step 4.
- First fine-category experiment produced 1,632 rows, but CATEGORY_SPEND had no positives. Do not train on this artifact. User chose source departments (32 broad metadata groups) instead of 303 fine categories; retain the whole-basket average base and regenerate. Require both labels within every type.
- Department pilot: 1,664 rows from 200 selected households, 159 represented after censoring; label 1 = 163 / 0 = 1,501. Per type positives: MIN_SPEND 105, CATEGORY_SPEND 13, MERCHANT_SPEND 41, PRODUCT_PURCHASE 4; every type has 416 rows.
- Full source normalized: 130,841 accepted / 25,007 rejected baskets. Rejecting whole baskets preserves amount integrity but removes 361 household/cutoff groups (4 samples each) and 92 future-censored candidates; plus 1,664 retained equals 3,200.
- Narrow tests passed after fixture correction; final full offline suite passed 50 tests in 4.97s using venv and workspace basetemp. This includes the original 25 regression tests.
- All 163 positive proofs independently checked against original R rows for owner, UTC validity, category/product/store and single-basket amount. Pilot hashes/CSV/schema/exclusion totals and all legacy artifact hashes match manifests. AST parsing passed.
- Final full-source regeneration into ignored external audit output was byte-identical for all six artifacts. Targeted Prettier and git diff whitespace checks passed. Steps 2–3 complete for the current pilot; no Step 4 started.

## Requirement-to-evidence summary

FR-S01/S03: eight-feature allow-list, exact policy/threshold validation, pre-cutoff selection and leakage tests. FR-C07/S06: four template types and independent single-basket proof validation; explicit source proxy limitation preserves production completion authority. FR-S04: source/policy/settings hashes, preview/proof/exclusion metadata and reproducibility. NFR-DATA-02/TIME-01: exact minor-unit/Decimal math, UTC boundaries and missing/censored-window tests. Production DB/logging/API coverage is intentionally deferred and not claimed.

## Open questions

- Production reward budget, trigger, eligibility, simultaneous assignments, mapping to the live catalog and USD-source/THB-platform domain validation remain integration decisions.
- Retrospective labels use source-sales basis, not proven net payment. Document this limitation; do not overwrite FR-S06 pricing rules.
- Any absent source file/reader must be reported; no fake fixture substituted for the pilot.
