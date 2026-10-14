# Requirements Delivery Checklist

เอกสารนี้เป็น progress tracker ของการพัฒนา โดยอ้างอิงข้อกำหนดจาก
[`docs/REQUIREMENTS.md`](./REQUIREMENTS.md) เป็นหลัก หากรายละเอียดในสองเอกสารไม่ตรงกัน
ให้ถือ `REQUIREMENTS.md` เป็นข้อกำหนด และแก้ checklist นี้ให้ตรงกับหลักฐานล่าสุด

ตรวจล่าสุด: 2026-10-14

## กติกาการอัปเดตสถานะ

- `[x] Complete` ใช้ได้เมื่อ implementation, authorization, frontend integration (ถ้ามี),
  error/empty/loading states ที่เกี่ยวข้อง และ tests ตามระดับความเสี่ยงผ่านจริงแล้วเท่านั้น
- `[ ] Partial` หมายถึงมีบางชั้นแล้ว แต่ยังมี API, UI, integration, security หรือ test gap
- `[ ] Not started` หมายถึงยังไม่มี behavior ที่ใช้งานได้จริง แม้อาจมี schema หรือ UI mock
- ห้ามนับ mock UI, schema อย่างเดียว, happy path อย่างเดียว หรือ unit test บางส่วนเป็น Complete
- ทุกครั้งที่ปิดงาน ให้เพิ่มหลักฐานเป็นชื่อ endpoint, source file และ test suite ที่ผ่าน
- หาก regression หรือ contract ไม่ตรงกัน ให้เปิด checkbox กลับทันที

## Workflow เมื่อสร้างหรือเปลี่ยน API

ห้ามติ๊ก requirement ที่เกี่ยวข้องเป็น Complete จนกว่าจะทำครบทุกข้อ:

1. อัปเดต controller/route, authorization, validation และ stable error contract
2. อัปเดต response/request contract และ frontend API client/types ที่ใช้งานจริง
3. เพิ่มหรือแก้ unit, integration/contract และ E2E tests ตามความเสี่ยง
4. อัปเดต Postman collection พร้อม environment/example request และ success/error examples
5. อัปเดต `README.md` ให้มี endpoint, วิธีรัน, authentication และตัวอย่างใช้งานล่าสุด
6. รัน tests, typecheck, lint, format check และ build ที่เกี่ยวข้อง
7. บันทึก evidence และ gap ที่เหลือในเอกสารนี้ก่อนติ๊ก `[x]`

> สถานะปัจจุบัน: มี Postman Collection v2.1 สำหรับ API ที่ implement จริง 24 requests ที่
> `postman/Thai-Please.postman_collection.json` พร้อม Local environment และคู่มือใช้งาน
> Requirement อื่นยังต้องมี contract/integration/E2E evidence ของตนก่อนประกาศ Complete

## Authentication and Registration

- [ ] **FR-AUTH-01 — Customer Registration — Partial**
  - มี: API/UI ลงทะเบียน, Citizen ID และวันเกิด validation, password hashing, สร้าง role/wallet
  - Gap API/Data: ยังไม่มีหลักฐาน audit event และ transaction/integration coverage ครบทุกกรณี
    existing identity, duplicate role, initial subsidy และ rollback
  - Gap Test/Docs: ยังขาด registration integration/E2E, Postman collection และ README contract

- [ ] **FR-AUTH-02 — Merchant Registration — Partial**
  - มี: API/UI ลงทะเบียนร้านและสถานะเริ่มต้น `PENDING`
  - Gap API/Data: merchant membership/OWNER model, audit event และ merchant-wallet invariants
    ยังไม่ครบตาม requirement
  - Gap Test/Docs: ยังขาด existing-identity integration, rollback/E2E, Postman และ README

- [ ] **FR-AUTH-03 — Password Policy — Partial**
  - มี: password validation, hash service และ unit tests
  - Gap Security: ยังไม่มีหลักฐาน rate limit/brute-force protection และ log-redaction verification ครบ
  - Gap Test: ยังขาด integration/negative security tests

- [ ] **FR-AUTH-04 — Login — Partial**
  - มี: แยก customer/merchant/admin login routes, session cookie, role guards และหน้า Login
  - Gap UI/API: pending merchant tracking flow และ permission-denied UX ยังไม่ครบ
  - Gap Test: ยังขาด portal/session authorization integration และ E2E ครบสาม portal

- [ ] **FR-AUTH-05 — Admin Creation — Not started**
  - Gap API/UI: ไม่มี admin-role grant/admin management flow และ last-active-admin protection
  - Gap Test/Audit: ไม่มี permission, temporary-password, audit และ E2E coverage

- [ ] **FR-AUTH-06 — Initial Admin — Not started**
  - Gap Ops/API: ไม่มี secure idempotent bootstrap/provisioning workflow ที่ยืนยันได้
  - Gap Test/Audit: ไม่มี bootstrap repeatability, forced password change และ audit tests

## Consumer Requirements

- [x] **FR-C01 — Consumer Overview — Complete**
  - API: authenticated consumer-only `GET /api/v1/wallet/overview`, scope ด้วย session user,
    aggregate wallet/program/quest/coupon และ bounded latest paid orders
  - UI: `ConsumerDashboard` เรียก API จริง; แสดงชื่อและ Citizen ID แบบ mask, integer-baht
    balances, daily subsidy, program, points, quests, coupons และ recent orders โดยไม่ fallback เป็น mock
  - States: loading, success, empty collections, generic error/retry, permission denied และ
    accessible live feedback
  - Evidence: `apps/api/src/wallet/wallet.service.spec.ts`,
    `apps/api/src/wallet/wallet.controller.spec.ts` และ
    `apps/web/src/features/consumer/pages/ConsumerDashboard.test.tsx`
  - Verified: Web tests 17/17, API tests 26/26, API E2E 1/1, typecheck/lint/build ทั้งสอง
    workspace และ changed-file Prettier ผ่านในรอบส่งมอบ FR-C01
  - Postman: `Consumer Wallet / Get Wallet Overview` พร้อม role, status checks และคำอธิบาย

- [x] **FR-C02 — Personal Top-up — Complete**
  - API: authenticated consumer-only `POST /api/v1/wallet/topup`; integer baht 1–50,000,
    idempotency key 8–128 ตัวอักษร, atomic Personal Balance credit และ ledger
    `PERSONAL/PERSONAL_TOPUP` โดยไม่เปลี่ยน Subsidy Balance หรือสร้าง Wallet/สิทธิ์โดยผลข้างเคียง
  - Idempotency: key+amount เดิมคืนผล ledger เดิม, key เดิมแต่ amount/owner/wallet/fund ต่างกันได้
    `409`; รองรับ replay ของ ledger เก่า `TOPUP` ที่ข้อมูลตรงกันโดยไม่เขียนข้อมูลย้อนหลังใหม่
  - History API: `GET /api/v1/wallet/transactions` scope ด้วย session user, กรองวันแบบ inclusive
    ตาม `Asia/Bangkok`, stable cursor pagination, default 20/max 100
  - UI: หน้า Wallet ใช้ overview/top-up/history API จริง; refresh ยอดและประวัติหลังสำเร็จ,
    stable retry key, double-submit guard, date filters, load more และ stale-response protection
  - States: loading, success, empty, validation, permission denied, conflict, network/refresh/history error
    พร้อม retry และ accessible live feedback
  - Evidence: `apps/api/src/wallet/wallet.service.spec.ts`,
    `apps/api/src/wallet/wallet.controller.spec.ts`, DTO specs,
    `apps/api/test/wallet-topup.e2e-spec.ts`, `apps/web/src/features/consumer/api/consumer.api.test.ts`
    และ `apps/web/src/features/consumer/views/WalletView.test.tsx`
  - Verified: API unit 70/70, API E2E 2/2, Web 39/39 และ typecheck/lint/build ทั้งสอง workspace
    รวมถึง changed-file Prettier และ Postman JSON ผ่านในรอบส่งมอบ FR-C02
  - Postman: overview/history, positive top-up, replay, reused-key conflict, zero, negative,
    fractional และ over-limit พร้อม assertions/คำอธิบาย
  - Residual NFR evidence: repository ยังไม่มี PostgreSQL wallet integration harness จึงยังไม่ถือว่า
    พิสูจน์ concurrent retry กับฐานข้อมูลจริง; ติดตามต่อภายใต้ `NFR-DATA-01`

- [ ] **FR-C03 — Daily Subsidy Status — Partial**
  - มี API/UI จริงบน Overview และ Wallet: balance, cap, used, remaining, percentage และ program
  - Gap Test: ต้องเพิ่ม Bangkok boundary/database integration และ E2E ของข้อมูลรายวัน

- [ ] **FR-C04 — Scan and Review QR — Partial**
  - มี backend preview/order context และ UI review แบบ mock
  - Gap API/UI: route/contract ยังไม่ตรง `GET /payments/qr/:token`; scanner และ review
    ยังไม่เชื่อมข้อมูลจริงครบ
  - Gap Test: expired/invalid/foreign QR contract และ E2E

- [ ] **FR-C05 — Payment — Partial**
  - มี backend atomic payment, wallet debit, merchant credit, coupon checks และ unit tests
  - Gap UI: payment flow ยังใช้ mock และไม่ได้เรียก API จริง
  - Gap Test: ต้องมี database integration สำหรับ duplicate/concurrent/rollback และ full E2E

- [ ] **FR-C06 — Order History and Receipt — Partial**
  - มี recent paid orders ใน Overview และ UI history/receipt แบบ mock
  - Gap API/UI: ไม่มี consumer history/receipt endpoints และ frontend integration ตาม contract
  - Gap Test: snapshot/immutability/ownership integration และ E2E

- [ ] **FR-C07 — Personalized Quest — Partial**
  - มี quest data/assignment บางส่วนและ Overview แสดงข้อมูลจริง
  - Gap API/Domain: deterministic one-order completion และ point issuance ยังไม่ครบ
  - Gap UI/Test: quest detail/history ยัง mock; ขาด completion/idempotency integration/E2E

- [ ] **FR-C08 — Point — Partial**
  - มี point balance/schema และ Overview แสดงยอดจริง
  - Gap API/UI: ไม่มี point history/source/expiry API และหน้าจอยัง mock
  - Gap Test: ledger reconciliation, expiry และ double-reward integration/E2E

- [ ] **FR-C09 — Coupon — Partial**
  - มี coupon schema, payment eligibility/use และ Overview แสดง owned coupons
  - Gap API/UI: ไม่มี catalogue/redeem endpoints และ frontend redemption/payment selection จริง
  - Gap Test: point redemption, ownership, expiry และ double-use E2E

## Merchant Requirements

- [ ] **FR-M01 — Merchant Approval — Partial**
  - มีสถานะเริ่มต้น `PENDING` และ merchant login checks บางส่วน
  - Gap API/UI: ไม่มี admin approve/reject workflow และ status-tracking UI ที่ครบ
  - Gap Test: POS/payment denial ทุก non-active state และ approval audit/E2E

- [ ] **FR-M02 — Product Management — Partial**
  - มี catalog/product API และ merchant UI บางส่วน
  - Gap API/UI: contract/path ยังไม่ตรง requirement ทุกเส้น และ edit/deactivate flow ยังไม่ครบ
  - Gap Test: merchant ownership, validation, history preservation และ E2E

- [ ] **FR-M03 — POS — Partial**
  - มีการสร้าง order จากสินค้าและ backend คำนวณราคา
  - Gap UI/API: cart lifecycle และหลายรายการยังต้องตรวจ integration ให้ครบ
  - Gap Test: server-side repricing, invalid/inactive product และ E2E

- [ ] **FR-M04 — QR Generation — Partial**
  - มี random QR token และ expiry สำหรับ order
  - Gap Security: database ยังเก็บ token ที่ค้นด้วยค่าตรง ไม่ใช่ hash-only ตาม requirement
  - Gap Test: unpredictability, expiry, replay และ one-order/one-payment integration

- [ ] **FR-M05 — Payment Status — Partial**
  - มี order status/backend payment commit และ merchant order listing
  - Gap UI/API: status refresh/polling และ `DRAFT/CHECKED_OUT/PAID/EXPIRED` lifecycle ยังไม่ครบ
  - Gap Test: ห้ามแสดง PAID ก่อน commit และ failure/retry E2E

- [ ] **FR-M06 — Merchant Wallet — Partial**
  - มี merchant wallet และเครดิต `finalAmount` ตอน payment
  - Gap API/UI: ไม่มี wallet/history/withdrawal endpoints และ owner withdrawal flow
  - Gap Test: atomic debit-credit, membership, insufficient balance, duplicate/concurrent withdrawal

- [ ] **FR-M07 — Merchant Dashboard — Not started**
  - Gap API/UI: ไม่มี production aggregate สำหรับ sales, subsidy/personal split, coupon,
    top products, trend และ freshness
  - Gap Test: ownership, aggregation correctness และ UI states

- [ ] **FR-M08 — Order and Receipt History — Partial**
  - มี merchant order listing และ UI บางส่วน
  - Gap API/UI: receipt view, immutable snapshots, filters/pagination และ integration ยังไม่ครบ
  - Gap Test: merchant ownership, paid-only receipt และ E2E

## System and AI Requirements

- [ ] **FR-S01 — Quest Generation — Not started**
  - Gap: ไม่มี AI/provider workflow ที่สร้าง personalized quest จากข้อมูลขั้นต่ำที่อนุญาต
  - Gap Test: deterministic fallback, privacy boundary และ generation integration

- [ ] **FR-S02 — Provider Abstraction — Not started**
  - Gap: ไม่มี provider interface/configuration/fallback implementation และ contract tests

- [ ] **FR-S03 — Output Validation — Not started**
  - Gap: ไม่มี schema/allow-list/policy validation สำหรับ AI output และ negative tests

- [ ] **FR-S04 — Generation Log — Partial**
  - มี `quest_generation_logs` schema
  - Gap API/Domain: ไม่มี generation service ที่เขียน log จริงหรือ admin query endpoint
  - Gap Test: audit completeness, redaction และ replay traceability

- [ ] **FR-S05 — Automatic Assignment — Partial**
  - มี user quest schema/query และ assignment behavior บางส่วน
  - Gap Domain: assignment จาก generation workflow, idempotency และ expiration lifecycle ยังไม่ครบ
  - Gap Test: duplicate assignment และ E2E visibility

- [ ] **FR-S06 — Deterministic Completion — Not started**
  - Gap Domain: ไม่มี rule engine ที่พิสูจน์ completion จาก paid receipt หนึ่งใบและให้ reward ครั้งเดียว
  - Gap Test: category/product/merchant/min-spend rules, expiry และ double reward

## Administrator Requirements

- [ ] **FR-A01 — Platform Overview — Not started**
  - Gap API/UI/Test: ไม่มี admin platform overview aggregate, portal page หรือ authorization tests

- [ ] **FR-A02 — Merchant Approval — Not started**
  - Gap API/UI/Test: ไม่มี approve/reject endpoints, audit, admin UI และ E2E

- [ ] **FR-A03 — Admin Management — Not started**
  - Gap API/UI/Test: ไม่มี admin grant/suspend/revoke, permission model และ last-admin protection

- [ ] **FR-A04 — Subsidy Program Management — Not started**
  - Gap API/UI/Test: มี schema/program read บางส่วน แต่ไม่มี admin CRUD, policy validation และ audit

- [ ] **FR-A05 — Quest Generation — Not started**
  - Gap API/UI/Test: ไม่มี admin trigger/review generation และ provider/output controls

- [ ] **FR-A06 — Reward Monitoring — Not started**
  - Gap API/UI/Test: ไม่มี reward metrics/reconciliation API, dashboard หรือ audit tests

- [ ] **FR-A07 — Social Impact Dashboard — Not started**
  - Gap API/UI/Test: ไม่มี verified social-impact aggregate, admin UI, freshness หรือ correctness tests

## Non-functional Requirements

- [ ] **NFR-DATA-01 — Transactional Integrity — Partial**
  - มี transaction/row-lock/idempotency และ deterministic retry tests ใน top-up กับ payment
  - Gap: ยังขาด real PostgreSQL concurrent integration สำหรับ top-up, payment, reward, coupon และ withdrawal

- [ ] **NFR-DATA-02 — Exact Arithmetic — Partial**
  - มี Prisma Decimal/decimal arithmetic ใน value-moving backend บางส่วน
  - Gap: ต้อง audit ทุก money path, constraints, rounding และ reconciliation tests

- [ ] **NFR-TIME-01 — Time — Partial**
  - มี UTC/Bangkok handling และ exclusive expiry บางเส้น
  - Gap: timestamp column consistency, DST-independent boundary tests และทุก expiry workflow

- [ ] **NFR-UX-01 — UI States — Partial**
  - FR-C01/FR-C02 มี loading/empty/error/success/retry/permission-denied และ duplicate-submission guard
    โดย API client preserve HTTP status
  - Gap: หน้าอื่นยังขาด loading/error/permission/expired/duplicate-submission states

- [ ] **NFR-ACC-01 — Accessibility — Partial**
  - มี semantic controls, labels และ live regions บางหน้า
  - Gap: ยังไม่มี keyboard/focus/contrast audit และ WCAG 2.2 AA automated/manual coverage ครบ

- [ ] **NFR-I18N-01 — Localization — Partial**
  - มี typed Thai localization resource และ FR-C01 ใช้งานแล้ว
  - Gap: ยังมี user-visible hardcoded/mock copy ในหน้าอื่นและไม่มี localization enforcement test

- [ ] **NFR-OBS-01 — Observability — Not started**
  - Gap: ไม่มีหลักฐานครบของ request/correlation IDs, structured logs, audit events,
    payment/reward metrics และ reconciliation reports

## Definition of Done ระดับระบบ

- [ ] Behavior และ Authorization ถูกต้องทุก Portal — Partial; consumer/merchant บางเส้นมี guard
      แต่ admin และ resource-level coverage ยังไม่ครบ
- [ ] Multiple Roles ทำงานโดยไม่สร้าง User ซ้ำ — Partial; มี role schema/registration บางส่วน
      แต่ integration/E2E ทั้งสาม portal ยังไม่ครบ
- [ ] Consumer Wallet และ Merchant Wallet แยกกันจริง — Partial; schema รองรับ แต่ยังขาด
      migration/integration/E2E และ membership model ครบ
- [ ] Payment Debit/Credit เป็น Atomic Transaction — Partial; implementation/unit tests มีแล้ว
      แต่ยังขาด database concurrency/integration/E2E
- [ ] Merchant Withdrawal เป็น Atomic และเข้าบัญชีผู้ถอนเท่านั้น — Not started
- [ ] Retry ไม่สร้างรายการซ้ำ — Partial; มีบาง operation แต่ยังไม่ครบ payment/reward/coupon/withdrawal
- [ ] Database Constraints และ Migration ถูกตรวจสอบ — Partial; มี migration เดียว แต่ยังไม่มี
      rollout/backfill/production-data validation ตาม migration requirements
- [ ] Frontend รองรับ Happy Path และ Error States — Partial; FR-C01 ครบระดับ feature
      แต่ portal อื่นและ permission/expired/duplicate states ยังไม่ครบ
- [ ] Unit, Integration และ End-to-End Tests ผ่าน — Partial; มี unit/component และ health E2E
      แต่ยังขาด integration/E2E acceptance flow
- [ ] API และเอกสารอัปเดตตรงกัน — Partial; endpoint บางชื่อยังไม่ตรง requirement,
      Postman ครอบคลุม implemented routes แล้ว แต่ README/API contract ระดับ requirement ยังไม่ครบ
- [ ] Audit และ Reconciliation พร้อมใช้งาน — Not started
- [ ] ไม่มี Password, Token หรือข้อมูลอ่อนไหวรั่วใน Log — Partial; password hashing/session มีแล้ว
      แต่ QR token ยังเก็บ raw และไม่มี security/log audit suite
- [ ] Demo Flow ทำงานครบ Registration ถึง Coupon Reuse — Not started; ยังขาด admin approval,
      real consumer payment UI, withdrawal, quest reward และ coupon redemption/reuse E2E

## หลักฐานที่ต้องบันทึกเมื่อปิด Requirement ถัดไป

- วันที่และผู้รับผิดชอบ
- Endpoint/route และ authorization policy
- UI route/component ที่เชื่อม API จริง
- Migration/constraint ที่เกี่ยวข้อง
- Test files และคำสั่งที่รันผ่าน
- Postman request/example ที่อัปเดต
- README/contract section ที่อัปเดต
- Known limitations, rollout และ recovery note
