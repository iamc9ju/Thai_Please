# FR-C03 Daily Subsidy Status ExecPlan

## Outcome

Consumer ที่เข้าสู่ระบบสามารถดูสถานะเงินสนับสนุนรายวันจาก API จริงได้ครบ ถูกต้องตามวัน `Asia/Bangkok` และหน้า Overview/Wallet แสดงข้อมูลเดียวกันโดยมีสถานะ loading, no-program, permission-denied และ retryable error ที่ตรวจสอบแล้ว

## Requirements

- `FR-C03`: แสดง Subsidy Balance, Daily Subsidy Cap, Subsidy Used Today, Subsidy Remaining Today, Subsidy Percentage และชื่อ/ช่วงเวลาโครงการ
- `BR-WALLET-02`: รวม `PAYMENT_SUBSIDY` ในช่วงครึ่งเปิด `[bangkok_day_start, next_bangkok_day_start)` โดยไม่แก้หรือลบ ledger เมื่อเปลี่ยนวัน
- `BR-WALLET-03`: `daily_remaining = max(0, daily_cap - subsidy_used_today)`; balance เป็นข้อจำกัดตอนชำระ ไม่ใช่สูตรสถานะวงเงินรายวัน
- `BR-MONEY-001`, `NFR-DATA-02`: คำนวณด้วย exact decimal; contract ใช้ Integer Baht และระบุ `THB`
- `NFR-TIME-01`: contract ระบุ `Asia/Bangkok`; วันเริ่ม/สิ้นสุดโครงการเป็น inclusive business date
- `BR-AUTH-001`, `BR-AUTH-002`: รับ owner จาก authenticated consumer session เท่านั้น

Acceptance criteria:

1. `GET /api/v1/wallet/subsidy` รับเฉพาะ Consumer และไม่รับ user/wallet id จาก client
2. Response มี currency/timezone/as-of, balance/cap/used/remaining และ program name/percentage/start/end ครบ
3. ไม่มี JavaScript floating-point arithmetic ในการรวมและคำนวณเงิน
4. ขอบวัน Bangkok, ค่าเกิน cap, no active program, wallet ผิดประเภท/ไม่ active และ read-only behavior มี tests
5. Overview และ Wallet เชื่อม endpoint FR-C03 จริงและแสดง loading/error/permission/no-program ครบ
6. HTTP E2E และ PostgreSQL integration test ยืนยัน contract/ขอบวันตามสภาพแวดล้อมที่รองรับ

Non-goals: ไม่พัฒนา FR-C04 ขึ้นไป, ไม่ทำ Admin subsidy CRUD, ไม่เปลี่ยน payment/QR/coupon/quest behavior และไม่สร้าง migration จากสมมติฐานของไฟล์ migration ที่สูญหาย

## Current State

- `/wallet/overview` มีข้อมูลส่วนใหญ่ แต่ route ไม่ตรง contract และรวมหลาย bounded concerns
- การรวมยอดใน overview ใช้ `Number` และ remaining ถูก clamp ด้วย balance ซึ่งไม่ตรงสูตรใน requirements
- Overview และ Wallet มี UI จริง แต่ยังไม่มี focused FR-C03 contract/tests ครบ
- Checklist ระบุว่าขาด Bangkok-boundary database integration และ E2E

## Invariants and Risks

- Ledger เป็น immutable; endpoint นี้ read-only
- ใช้ session owner เท่านั้นและปฏิเสธ wallet ที่ไม่ใช่ active consumer
- ห้ามใช้ float ในการคำนวณเงิน
- `wallet_transactions.created_at` ยังเป็น timestamp without timezone; ห้าม migration/backfill โดยไม่มีหลักฐาน timezone ของข้อมูลเดิม
- Migration history ของ development database มี `P3015`; งานนี้ไม่เดาไฟล์ migration ที่หาย

## Decisions

- เพิ่ม dedicated additive endpoint `/wallet/subsidy`; คง `/wallet/overview` เพื่อ backward compatibility
- ใช้ Integer Baht ตาม product requirement และระบุ `currency: THB`, `timeZone: Asia/Bangkok`
- ใช้ Prisma Decimal สำหรับ aggregation/calculation แล้วแปลงเป็น integer number ที่ API boundary
- `dailySubsidyRemaining` เป็น cap remaining ตามสูตร requirement; `subsidyBalance` แสดงแยก
- เลือก active program แบบ deterministic โดย latest start date/program id เมื่อข้อมูลผิดปกติซ้อนกัน และบันทึก DB overlap constraint เป็นงาน Admin policy/migration ภายหลัง

## Execution Steps

1. Backend/API owner: implement contract, exact calculation, authorization/wallet-state checks, unit/HTTP/PostgreSQL tests, Postman.
2. Frontend owner: connect dedicated API, types/copy/states, focused component/API tests.
3. Primary: integrate, resolve contract differences, update checklist and traceability.
4. QA reviewer: independently verify requirements, security, exact money, Bangkok boundaries and UX; defects return to owners.
5. Primary: run targeted then broad checks and record evidence.

## Verification

- Targeted API unit and E2E tests
- Targeted web API/component tests
- Real PostgreSQL integration when a disposable database is reachable
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, API E2E and builds
- Manual contract review against all FR-C03 fields and negative states

## Rollout and Recovery

- Additive endpoint; existing overview remains compatible
- No schema migration or data rewrite in this increment
- Source rollback removes the endpoint/UI integration without touching ledger history

## Progress Log

- 2026-10-15: Project Manager mapped FR-C03 requirements and delegated read-only Backend/Web audits.
- 2026-10-15: Found route mismatch, floating-point calculation, remaining-formula mismatch and missing DB/E2E evidence.
- 2026-10-15: Locked contract and assigned non-overlapping Backend/Frontend implementation.
- 2026-10-15: Backend added the dedicated endpoint, exact Decimal calculation, authorization/wallet-state checks, unit/controller/HTTP tests, safe opt-in PostgreSQL integration spec and Postman contract.
- 2026-10-15: Frontend connected Overview and Wallet, added runtime response validation, coherent displayed totals, complete UI states and focused regression tests.
- 2026-10-15: QA round one found runtime validation, mixed-snapshot totals and HTTP authorization evidence gaps; owners fixed all three.
- 2026-10-15: QA round two found decimal subsidy percentages were rejected; parser/tests were corrected to allow finite 0–100 decimals.
- 2026-10-15: QA round three PASS with no FR-C04+ scope expansion. API service 41, controller 8, web API 28, Wallet 22 and Dashboard 10 targeted tests passed; lint, typecheck, build, Prisma validation, changed-file formatting and diff checks passed.
- 2026-10-15: Real PostgreSQL spec remains safely skipped because this environment has no explicitly authorized disposable test database; HTTP E2E cannot open localhost inside the sandbox.

## Open Questions

- Historical timestamp timezone cannot be migrated safely until original migration history and stored-time semantics are recovered; tracked as residual `NFR-TIME-01` and does not authorize guessed backfill.
- Execute the committed PostgreSQL integration spec with `ALLOW_TEST_DATABASE_MUTATION=true` and a `TEST_DATABASE_URL` whose database name ends in `_test` or `-test` before changing FR-C03 from Partial to Complete.
