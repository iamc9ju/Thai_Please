# FR-C02 Personal Top-up ExecPlan

## Outcome

Consumer สามารถเติมเงินจำลองเข้ากระเป๋าส่วนตัวจากหน้า Wallet ได้จริง เห็นยอดและประวัติที่อัปเดตจากฐานข้อมูล การ retry ไม่เพิ่มยอดซ้ำ และทุกเงื่อนไขของ FR-C02 มีหลักฐานทดสอบก่อนส่งมอบ

## Requirements

- เติมได้เฉพาะ Personal Balance และ Subsidy Balance ต้องไม่เปลี่ยน
- เป็น Virtual Top-up เท่านั้น
- สร้าง Wallet Transaction ประเภท `PERSONAL_TOPUP`
- ทุกคำขอต้องมี Idempotency Key และ retry ของคำขอเดิมต้องไม่เพิ่มยอดซ้ำ
- ปฏิเสธยอดศูนย์ ยอดติดลบ ยอดไม่เป็นจำนวนเต็ม และยอดเกินเพดานที่กำหนดร่วมกันทั้งระบบ
- หน้า Wallet ใช้ API จริง แสดง loading, success, validation, authorization, conflict และ network-error states และแสดงยอด/ประวัติใหม่หลังสำเร็จ
- Postman collection และเอกสาร checklist ต้องตรงกับพฤติกรรมจริง
- Non-goals: ไม่ทำ FR-C03-FR-C09 เพิ่มเติม ยกเว้นข้อมูล FR-C03 ที่มีอยู่แล้วและจำเป็นต้องแสดงในหน้า Wallet; ไม่ redesign portal ทั้งระบบ

## Current State

- Backend มี consumer-only top-up และ transaction-history endpoints, strict DTOs, Decimal arithmetic, transaction/row lock, unique business reference และ legacy replay compatibility
- Frontend WalletView ใช้ overview/top-up/history APIs จริงและไม่มี mock/fake-success path หรือ unused TopUpModal
- API unit/controller/DTO, HTTP contract E2E และ frontend integration tests ครอบคลุม acceptance/negative/retry/history paths
- Postman และ requirement checklist ตรงกับ contract ปัจจุบัน; deploy migration ที่รองรับ `PERSONAL_TOPUP` แล้วและรอทดสอบ top-up/runtime journey จริง
- ข้อจำกัดที่ทราบ: ไม่มี PostgreSQL wallet integration harness สำหรับพิสูจน์ concurrent transactions จริง

## Invariants and Risks

- Authorization ใช้ session userId เท่านั้นและต้องเป็น role `CONSUMER`; ห้ามรับ wallet/user identity จาก client
- เงินต้องใช้หน่วยและ precision เดียวกันตลอดเส้นทาง; รอบนี้ยึด integer baht ตาม DTO ปัจจุบันและเพดาน 50,000 บาทต่อรายการ
- การอัปเดต balance และ ledger ต้อง atomic; concurrent retry key เดียวเพิ่มยอดได้ครั้งเดียว
- Idempotency key เดิมที่ payload ต่างกันต้องถูกปฏิเสธ ไม่คืน success ที่ทำให้เข้าใจผิด
- Idempotency key ต้องมีเพดานความยาว/รูปแบบที่สอดคล้องกับ `business_ref varchar(160)` และห้าม log ค่า key เต็ม
- Top-up ห้ามสร้างหรือให้ subsidy โดยผลข้างเคียง; wallet ที่หายต้องเป็นสถานะผิดปกติที่ปลอดภัย
- ห้ามใส่ข้อมูลจริงหรือ secrets ใน fixtures, Postman หรือ logs

## Decisions

- ใช้หน้า `WalletView` เป็น canonical UI และลบ/รวมพฤติกรรมซ้ำจาก modal แทนการคงสอง implementation
- ใช้เพดาน 50,000 integer baht ให้ตรง backend ปัจจุบัน; expose เป็น shared frontend constant/contract เท่าที่โครงสร้างปัจจุบันรองรับ
- ใช้ `PERSONAL_TOPUP` เป็น ledger transaction type ตาม Requirement; ยอมรับ legacy `TOPUP` เฉพาะการ replay ที่ owner/wallet/fund/amount ตรงกันและไม่ rewrite ข้อมูลย้อนหลัง
- เก็บ idempotency key ไว้ตลอด logical attempt และสร้างใหม่หลังสำเร็จหรือเมื่อผู้ใช้เปลี่ยนจำนวนเงิน
- เพิ่ม consumer wallet-history endpoint แบบ date range และ cursor pagination เพราะ overview มีเพียง 10 รายการและไม่สามารถรองรับตัวกรองย้อนหลังของ UI อย่างถูกต้องได้

## Execution Steps

1. **Backend/API owner — completed:** แก้ contract/invariants/idempotency/ledger/missing-wallet, เพิ่ม wallet-history API และ unit/controller/DTO/HTTP tests
2. **Frontend owner — completed:** เชื่อม WalletView กับ overview/top-up/history API จริง พร้อม states, refresh, date filters, pagination, stale guard และ tests
3. **QA owner — completed with defects:** requirement review พบ history filter ใช้ข้อมูล overview เพียง 10 รายการ, ไม่มี PostgreSQL concurrency proof/HTTP journey, Postman negative cases ไม่ครบ และ formatting สองไฟล์; defect compatibility legacy TOPUP แก้แล้ว
4. **Project manager — pending runtime verification:** รวมงาน แก้ integration defects อัปเดต Postman, README/checklist รัน verification และ deploy database migration แล้ว แต่ยังต้องยืนยัน top-up กับฐานข้อมูลจริง

## Verification

- API unit/controller tests: auth role, DTO boundaries, personal-only, subsidy unchanged, exact transaction type, inactive/missing wallet, replay and mismatched payload
- Deterministic transaction/row-lock tests ตาม infrastructure ที่ repo รองรับ: duplicate/concurrent-state key เพิ่มยอดและ ledger ครั้งเดียว; ไม่อ้างเป็น real PostgreSQL concurrency proof
- Web tests: real API call payload, stable idempotency retry, loading/double-submit prevention, errors, success refresh, real transaction history/date filter
- HTTP/E2E contract: route, ValidationPipe และ session identity ถึง service; full database journey ถูกติดตามเป็น NFR residual เพราะ test harness ปัจจุบันไม่มี PostgreSQL wallet fixture
- Run web/API typecheck, lint, unit tests, API E2E, builds และ changed-file formatting
- Validate Postman JSON and document repeat/negative tests without credentials

## Rollout and Recovery

- Deploy migration `20261015090000_allow_personal_topup_transaction_type` ก่อนเปิดใช้ top-up; migration ขยาย check constraint ให้รองรับ transaction types ปัจจุบันและคง `TOPUP` สำหรับ legacy replay โดยไม่ rewrite ledger
- ขั้น `VALIDATE CONSTRAINT` จะสแกนตารางและอาจถือ lock จึงต้องรันเป็น controlled release step; หากล้มเหลว transaction ของ migration จะคืน constraint เดิม
- หาก validation ล้มเหลว ให้หยุดส่งมอบและแก้ใน branch/workspace เดิม; ห้ามแก้ยอดเงินจริงด้วย manual database mutation
- Recovery คือ revert application changes; ledger/balance writes remain atomic and must not be silently rewritten

## Progress Log

- 2026-10-14: ตรวจ Requirement และ current implementation; พบ transaction-type mismatch, mock canonical UI, limit mismatch, unused live modal, incomplete tests และ stale checklist
- 2026-10-14: สร้าง ExecPlan และมอบหมาย backend/frontend/QA แบบแยกขอบเขต
- 2026-10-14: QA preliminary audit ยืนยัน missing-wallet subsidy side effect, raw idempotency-key logging, key-length bound, top-up authorization/HTTP-boundary tests และ real PostgreSQL concurrency proof เป็นจุดที่ต้องปิดหรือบันทึกเป็น residual risk อย่างชัดเจน
- 2026-10-14: Backend/API และ frontend integration รอบแรกผ่าน unit/static/build checks; Postman เพิ่ม happy/replay/conflict/zero/over-limit scenarios
- 2026-10-14: QA รอบแรก FAIL เพราะ date filter กรองเฉพาะ overview 10 รายการ, HTTP/E2E และ real-DB concurrency evidence ไม่ครบ, Postman ขาด negative/fractional และ formatting สองไฟล์ จึงเปิด implementation รอบสองแทนการส่งมอบ
- 2026-10-14: รอบสองเพิ่ม wallet-history API แบบ Bangkok date range/cursor, เชื่อม server-side filter/load-more/stale guard, เพิ่ม HTTP contract E2E และ Postman negative/fractional cases
- 2026-10-14: API unit 70/70, API E2E 2/2 และ Web 39/39 ผ่าน พร้อม typecheck/lint/build และ changed-file formatting; ปิด FR-C02 โดยบันทึก real PostgreSQL concurrency proof เป็น residual ของ NFR-DATA-01
- 2026-10-15: Runtime top-up พบ PostgreSQL SQLSTATE `23514` เพราะฐานข้อมูลยังใช้ `wallet_transactions_transaction_type_check` รุ่นเก่าที่ไม่รองรับ `PERSONAL_TOPUP`; transaction ล้มและ rollback โดยไม่มี partial credit
- 2026-10-15: เพิ่ม forward migration สำหรับ widened transaction-type constraint และ regression spec; API unit 73/73, API E2E 2/2, migration spec 3/3, Prisma validate/typecheck/lint/build/format ผ่าน แต่ยังไม่ได้ deploy ฐานข้อมูล จึงเปิดสถานะ FR-C02 กลับเป็น Partial
- 2026-10-15: Deploy migration สำเร็จบน development database และตรวจแบบ read-only ว่า migration finished, ไม่ถูก rollback และ constraint validated พร้อมยอมรับ `PERSONAL_TOPUP`/legacy `TOPUP`
- 2026-10-15: `prisma migrate status` พบ pre-existing `P3015` เพราะ migration เก่าสอง directory ไม่มี `migration.sql`; ห้ามสร้างเนื้อหาเดาหรือลบประวัติ ต้องกู้ไฟล์ต้นฉบับ/checksum ที่ตรงกับ migration ที่ apply แล้ว

## Open Questions

- ต้องทดสอบ `POST /api/v1/wallet/topup` และ history กับ runtime จริงก่อนปิด FR-C02
- ต้องกู้ migration SQL ต้นฉบับของ `20261013150000_neon_baseline` และ `20261013160000_neon_multi_role_wallets` เพื่อปิด `P3015` โดยไม่ทำลาย migration history
- งานสร้าง PostgreSQL wallet integration harness เป็น residual ของ NFR-DATA-01 และไม่ถือว่าทำเสร็จใน plan นี้
