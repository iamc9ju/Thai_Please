# Approved prototype decisions

Status: approved by the user's implementation request on 2026-10-06. These decisions resolve only the narrow prototype behavior and do not silently close the broader production TBDs in `REQUIREMENTS.md`.

| Decision                     | Prototype value                                                                                             | Related requirements/TBD                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Login                        | Existing-user login by 13-digit citizen ID only; no register/email/password                                 | `FR-C01`, `TBD-001`                             |
| Database IDs                 | PostgreSQL integer auto-increment primary keys; opaque public session/QR tokens protect sensitive workflows | schema decision                                 |
| Money                        | Integer baht, currency `THB`                                                                                | `TBD-002`, `TBD-003`                            |
| Initial subsidy              | One 1,000-baht immutable subsidy grant per provisioned wallet                                               | `FR-C01`, `FR-C03`                              |
| Subsidy split                | Up to 60% subsidy and remainder personal balance                                                            | `FR-C03`                                        |
| Daily subsidy cap            | 200 baht per Bangkok calendar day, calculated from immutable subsidy-payment ledger entries                 | `FR-C03`                                        |
| Coupon order                 | One owned fixed-amount coupon; discount before final amount; single use                                     | `FR-C07`, `FR-M03`, narrow `TBD-004` resolution |
| QR/coupon/point/quest expiry | Durations are validated environment policy; expiry boundary is exclusive                                    | `TBD-005`, `TBD-007`, `TBD-008`                 |
| Quest proposal               | Deterministic history/category mock provider; deterministic rule engine is authoritative                    | `FR-S01`, `FR-S02`                              |
| Successful receipts          | Immutable; no cancel, edit, delete, or refund path                                                          | `FR-C04`                                        |

Still unresolved: production identity assurance and recovery, tax/rounding beyond integer baht, multiple-discount stacking, full reward budget/cadence policy, analytics attribution formulas, SLO/RPO/RTO, and retention/anonymization.
