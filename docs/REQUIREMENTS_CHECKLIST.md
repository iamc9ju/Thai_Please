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

> สถานะปัจจุบัน: มี Postman Collection v2.1 สำหรับ API ที่ implement จริง 31 requests ที่
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
  - มี: แยก customer/merchant/admin login routes, session cookie, role guards, หน้า Login และระบบจดจำข้อมูลเข้าสู่ระบบแยกตามบทบาท
  - Gap UI/API: pending merchant tracking flow และ permission-denied UX ยังไม่ครบ
  - Gap Test: ยังขาด portal/session authorization integration และ E2E ครบสาม portal

- [ ] **FR-AUTH-05 — Admin Creation — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/admin/users/admins`, `POST /api/v1/admin/users/:userId/roles/admin`, `PATCH /api/v1/admin/users/:userId/roles/admin` พร้อมระบบป้องกันการระงับผู้ดูแลคนสุดท้าย (Last-Active-Admin Protection) และเพิกถอน Session อัตโนมัติเมื่อถูกระงับ
  - UI: `AdminDashboard.tsx` (แท็บจัดการผู้ดูแล) รองรับการมอบสิทธิ์ `ADMIN` ให้ผู้ใช้งานที่มีอยู่ และระงับ/คืนสิทธิ์พร้อมบันทึก Audit Event
  - Evidence: `apps/api/src/admin/admin.service.spec.ts`, `apps/web/src/features/admin/pages/AdminDashboard.test.tsx`
  - Gap Test: E2E ร่วมกับฐานข้อมูลสด

- [ ] **FR-AUTH-06 — Initial Admin — Partial (Seed & Trigger Verified)**
  - มี idempotent provisioning ใน `apps/api/prisma/seed.js` ร่วมกับ PostgreSQL trigger ตรวจสอบ `created_by_admin_id`
  - Gap Test: forced password change E2E

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

- [ ] **FR-C02 — Personal Top-up — Partial (deploy migration แล้ว รอทดสอบ runtime)**
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
  - Database migration: เพิ่ม
    `apps/api/prisma/migrations/20261015090000_allow_personal_topup_transaction_type/migration.sql`
    เพื่อให้ constraint รองรับ `PERSONAL_TOPUP` และคง legacy `TOPUP`; regression spec ผ่าน 3/3
    และ `apps/web/src/features/consumer/views/WalletView.test.tsx`
  - Verified: API unit 73/73, API E2E 2/2, Web 39/39 และ typecheck/lint/build ทั้งสอง workspace
    รวมถึง changed-file Prettier และ Postman JSON ผ่านในรอบส่งมอบ FR-C02
  - Runtime verification: deploy migration ไปยังฐานข้อมูล development แล้วเมื่อ 2026-10-15 และตรวจพบว่า
    constraint ถูก validate พร้อมรองรับ `PERSONAL_TOPUP`/legacy `TOPUP`; ต้องยิง top-up จริงสำเร็จ
    และตรวจยอด/ประวัติก่อนจึงทำเครื่องหมาย Complete
  - Migration-history maintenance: migration เก่า `20261013150000_neon_baseline` และ
    `20261013160000_neon_multi_role_wallets` ไม่มี `migration.sql` ใน working copy ทำให้
    `prisma migrate status` ตอบ `P3015`; ไม่กระทบ constraint ที่ deploy แล้ว แต่ต้องกู้ไฟล์ต้นฉบับ
    แทนการสร้าง SQL เดาหรือลบประวัติ
  - Postman: overview/history, positive top-up, replay, reused-key conflict, zero, negative,
    fractional และ over-limit พร้อม assertions/คำอธิบาย
  - Residual NFR evidence: repository ยังไม่มี PostgreSQL wallet integration harness จึงยังไม่ถือว่า
    พิสูจน์ concurrent retry กับฐานข้อมูลจริง; ติดตามต่อภายใต้ `NFR-DATA-01`

- [ ] **FR-C03 — Daily Subsidy Status — Partial**
  - มี API/UI จริงบน Overview และ Wallet: balance, cap, used, remaining, percentage และ program
  - Gap Test: ต้องเพิ่ม Bangkok boundary/database integration และ E2E ของข้อมูลรายวัน

- [ ] **FR-C04 — Scan and Review QR — Partial (Frontend & Backend Integrated)**
  - มี backend preview/order context (`POST /api/v1/consumer/orders/preview`)
  - UI: `PaymentView.tsx` และ `qr-decoder.ts` เชื่อมต่อ API จริง รองรับทั้งการเปิดกล้องสแกน QR จริง (`getUserMedia` + `BarcodeDetector`/`jsQR`), การอัปโหลดไฟล์รูปภาพ QR Code, การวางรหัส QR Token, demo preview, ตรวจสอบรายการสินค้า, นับถอยหลังวันหมดอายุ (Expiry Countdown), ส่วนลดคูปอง และคำนวณสัดส่วนเงินสนับสนุน/เงินส่วนตัว Authoritative จาก Server
  - Evidence: `apps/web/src/features/consumer/views/PaymentView.test.tsx`, `apps/web/src/features/consumer/utils/qr-decoder.ts`, `apps/web/src/features/consumer/api/consumer.api.ts`
  - Gap Test: E2E ร่วมกับฐานข้อมูลสด

- [ ] **FR-C05 — Payment — Partial (Frontend Integrated with API)**
  - มี backend atomic payment (`POST /api/v1/consumer/orders/pay`), wallet debit, merchant credit, coupon checks, quest completion evaluation และ unit tests
  - UI: `PaymentView.tsx` รองรับการยืนยันชำระเงินจริง ป้องกัน Double-submission ด้วย loading state, ตรวจสอบยอดเงินส่วนตัว (`canAfford`) และแสดงหน้าใบเสร็จรับเงินสำเร็จ (Success Receipt)
  - Evidence: `apps/web/src/features/consumer/views/PaymentView.test.tsx`, `apps/api/src/order/order.service.spec.ts`
  - Gap Test: database integration สำหรับ duplicate/concurrent/rollback บน environment จริง

- [ ] **FR-C06 — Order History and Receipt — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/consumer/orders` (รองรับกรอง `dateFrom`/`dateTo`) และ `GET /api/v1/consumer/orders/:id/receipt` (ตรวจสอบสิทธิ์เจ้าของ order และคืน snapshot ใบเสร็จพร้อม masked citizenId)
  - UI: `OrdersView.tsx` และ `DigitalReceiptModal.tsx` เชื่อมต่อ API จริง แสดงประวัติคำสั่งซื้อ ค้นหา/กรองตามสถานะและวันที่ และเปิดดูใบเสร็จรับเงินดิจิทัลฉบับเต็ม
  - Evidence: `apps/api/src/order/order.service.spec.ts`, `apps/web/src/features/consumer/views/OrdersView.test.tsx`, `apps/web/src/features/consumer/pages/ConsumerDashboard.test.tsx`
  - Gap Test: E2E ตรวจสอบ immutability ร่วมกับฐานข้อมูลสด

- [ ] **FR-C07 — Personalized Quest — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/consumer/quests` (และ `/api/v1/quests`) คืนรายการภารกิจที่กำลังทำ ประวัติภารกิจที่สำเร็จ/หมดอายุ วันหมดอายุ แต้มที่ได้รับ และเลขอ้างอิงใบเสร็จ (`completedOrderId`/`receiptNumber`)
  - UI: `QuestsView.tsx` (Blue Theme) แสดง KPI ภารกิจ แท็บกำลังทำ/ประวัติภารกิจ และปุ่มกดดูใบเสร็จดิจิทัลของบิลที่ทำภารกิจสำเร็จ
  - Evidence: `apps/api/src/quests/quests.controller.spec.ts`, `apps/api/src/quests/quests.service.spec.ts`, `apps/web/src/features/consumer/views/QuestsView.test.tsx`
  - Gap Test: E2E ร่วมกับฐานข้อมูลสด

- [ ] **FR-C08 — Point — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/consumer/points` (และ `/api/v1/points`) คืนยอด `pointBalance`, พอยต์ที่ใกล้หมดอายุใน 30 วัน และประวัติ `point_transactions` พร้อมแหล่งที่มา (ภารกิจ/คูปอง) และวันหมดอายุ
  - UI: `CouponsView.tsx` (Blue Theme) แสดงยอดพอยต์ แจ้งเตือนพอยต์ใกล้หมดอายุ และรายการประวัติพอยต์จริงจาก API
  - Evidence: `apps/api/src/rewards/rewards.service.spec.ts`, `apps/web/src/features/consumer/views/CouponsView.test.tsx`
  - Gap Test: database integration สำหรับ point expiry job

- [ ] **FR-C09 — Coupon — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/consumer/coupons` (รายการคูปองที่เปิดให้แลก + คูปองของฉัน) และ `POST /api/v1/consumer/coupons/:id/redeem` แลกพอยต์เป็นคูปองแบบ Atomic Transaction (Row Lock ผู้ใช้, ตรวจพอยต์, หักพอยต์, สร้าง `point_transactions` และ `user_coupons`)
  - UI: `CouponsView.tsx` (Blue Theme) แสดงคูปองของฉันพร้อมสถานะ (`AVAILABLE`/`USED`/`EXPIRED`), แค็ตตาล็อกแลกคูปอง, ปุ่มกดแลกคูปองพร้อมอัปเดตยอดทันที และปุ่มนำไปใช้สแกนจ่ายเงินใน `PaymentView.tsx`
  - Evidence: `apps/api/src/rewards/rewards.service.spec.ts`, `apps/web/src/features/consumer/views/CouponsView.test.tsx`
  - Gap Test: E2E แลกพอยต์และใช้คูปองลดราคาบนฐานข้อมูลจริง

## Merchant Requirements

- [ ] **FR-M01 — Merchant Approval — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/admin/merchants` และ `POST /api/v1/admin/merchants/:id/approve|reject|suspend|activate` พร้อมการเปิดใช้งาน `MERCHANT` role และ `MERCHANT` wallet อัตโนมัติเมื่ออนุมัติ และบังคับตรวจสถานะ `ACTIVE` ก่อนสร้าง Order บน POS
  - UI: `AdminDashboard.tsx` (แท็บอนุมัติร้านค้า) แสดงรายการร้านค้า ตัวกรองสถานะ และปุ่มอนุมัติ/ปฏิเสธ/ระงับพร้อม Audit Event
  - Evidence: `apps/api/src/admin/admin.service.spec.ts`, `apps/web/src/features/admin/pages/AdminDashboard.test.tsx`
  - Gap Test: E2E approval flow ร่วมกับฐานข้อมูลสด

- [ ] **FR-M02 — Product Management — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/merchant/products?includeInactive=true`, `POST /api/v1/merchant/products`, `PUT /api/v1/merchant/products/:productId`, `PATCH /api/v1/merchant/products/:productId/status`, และ `DELETE /api/v1/merchant/products/:productId` ตรวจสอบสิทธิ์เจ้าของร้านและหมวดหมู่ พร้อมคง Immutable Snapshot บน `order_items` ย้อนหลัง
  - UI: `MerchantPos.tsx` (Blue Theme) รองรับการเพิ่มสินค้า แก้ไขชื่อ/ราคา/หมวดหมู่/รายละเอียด เปิด-ปิดการขายสินค้า (`ACTIVE`/`INACTIVE`) กรองตามสถานะ และซิงก์ตะกร้าสินค้าอัตโนมัติ
  - Evidence: `apps/api/src/catalog/catalog.service.spec.ts`, `apps/web/src/features/merchant/pages/MerchantPos.test.tsx`
  - Gap Test: E2E ร่วมกับฐานข้อมูลสด

- [ ] **FR-M03 — POS — Partial (Frontend & Backend Integrated)**
  - API: `POST /api/v1/merchant/orders` ตรวจสอบสถานะร้านค้า `ACTIVE` และคำนวณราคาสินค้า (`unitPrice`, `lineTotal`, `subtotal`, `finalAmount`) จากฐานข้อมูลพร้อมบันทึก `productNameSnapshot`
  - UI: `MerchantPos.tsx` รองรับเลือกสินค้าหลายรายการ ปรับจำนวน คำนวณยอดรวม และสร้าง QR ชำระเงิน
  - Evidence: `apps/api/src/order/order.service.spec.ts`, `apps/web/src/features/merchant/pages/MerchantPos.test.tsx`
  - Gap Test: E2E ร่วมกับฐานข้อมูลสด

- [ ] **FR-M04 — QR Generation — Partial (Frontend & Backend Integrated)**
  - มี random QR token และ expiry สำหรับ order พร้อมปุ่มคัดลอกรหัส Token และปุ่มดาวน์โหลดรูปภาพ QR Code ใน `MerchantPos.tsx`
  - Gap Security: database ยังเก็บ token ที่ค้นด้วยค่าตรง ไม่ใช่ hash-only ตาม requirement
  - Gap Test: unpredictability, expiry, replay และ one-order/one-payment integration

- [ ] **FR-M05 — Payment Status — Partial**
  - มี order status/backend payment commit, merchant order listing และ auto-polling สถานะการชำระเงินในหน้า POS พร้อมแสดงหน้าชำระเงินสำเร็จและเปิดใบเสร็จดิจิทัลได้ทันที
  - Gap UI/API: `DRAFT/CHECKED_OUT/PAID/EXPIRED` lifecycle เต็มรูปแบบและ E2E ยังไม่ครบ
  - Gap Test: ห้ามแสดง PAID ก่อน commit และ failure/retry E2E

- [ ] **FR-M06 — Merchant Wallet — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/merchant/wallet` (และ `/api/v1/merchants/:id/wallet`), `GET /api/v1/merchant/wallet/transactions`, และ `POST /api/v1/merchant/wallet/withdrawals` โอนเงินเสมือนจาก `Merchant Wallet` เข้าสู่ `Consumer Wallet.personal_balance` ของเจ้าของร้านแบบ Atomic Transaction พร้อม Row Lock, Idempotency Key และบันทึก `MERCHANT_WITHDRAWAL` / `MERCHANT_WITHDRAWAL_CREDIT`
  - UI: `MerchantWalletView.tsx` (Blue Theme) แสดงยอดคงเหลือร้านค้า รายรับแยกตามบิล (Subsidy/Personal Portion) ประวัติธุรกรรมกระเป๋าเงิน และฟอร์มถอนเงินเข้ากระเป๋าประชาชนของเจ้าของร้านพร้อมอัปเดตยอดทันที
  - Evidence: `apps/api/src/wallet/merchant-wallet.service.spec.ts`, `apps/web/src/features/merchant/views/MerchantWalletView.test.tsx`
  - Gap Test: real PostgreSQL concurrent integration สำหรับ duplicate/concurrent withdrawal

- [ ] **FR-M07 — Merchant Dashboard — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/merchant/dashboard` (และ `/api/v1/merchants/:id/dashboard`) คำนวณ `totalSales`, `orderCount`, `subsidyReceived`, `personalPaymentReceived`, `couponOrders`, `topProducts`, `salesTrend` (ตามวันใน `Asia/Bangkok` 7/14/30 วัน) และ `dataFreshness`
  - UI: `MerchantDashboardView.tsx` (Blue Theme) แสดง KPI 5 การ์ด แถบสัดส่วนเงินสนับสนุนรัฐเทียบเงินส่วนตัว กราฟแนวโน้มยอดขายรายวัน และตารางอันดับสินค้าขายดี
  - Evidence: `apps/api/src/wallet/merchant-wallet.service.spec.ts`, `apps/web/src/features/merchant/views/MerchantDashboardView.test.tsx`
  - Gap Test: E2E ร่วมกับฐานข้อมูลสด

- [ ] **FR-M08 — Order and Receipt History — Partial (Backend Receipt API & POS History Integrated)**
  - API: `GET /api/v1/merchant/orders` และ `GET /api/v1/merchant/orders/:id/receipt` ตรวจสอบสิทธิ์ร้านค้าและแสดงใบเสร็จฉบับเต็ม
  - UI: `MerchantPos.tsx` (Blue Theme) รองรับดูประวัติรายการขาย ค้นหา/กรองตามสถานะและวันที่ และเปิด `DigitalReceiptModal` ดูใบเสร็จย้อนหลังได้
  - Gap Test: merchant ownership integration และ E2E

## System and AI Requirements

- [ ] **FR-S01 — Quest Generation — Partial**
  - มี AI/provider workflow ที่สร้าง personalized quest จากข้อมูลขั้นต่ำที่อนุญาต
  - Gap Test: E2E ร่วมกับฐานข้อมูลสด

- [ ] **FR-S02 — Provider Abstraction — Partial**
  - มี provider interface/configuration/fallback implementation และ unit tests

- [ ] **FR-S03 — Output Validation — Partial**
  - มี schema/allow-list/policy validation สำหรับ AI output และ negative tests

- [ ] **FR-S04 — Generation Log — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/admin/quest-generation-logs` คืนรายการ `quest_generation_logs` พร้อมข้อมูล Provider, Model Version, Prompt Version, Policy Version, Selection Reason และภารกิจที่สร้าง
  - UI: `AdminDashboard.tsx` (แท็บ AI สร้างภารกิจ) แสดงรายการบันทึกการสร้างภารกิจย้อนหลังครบถ้วน
  - Evidence: `apps/api/src/admin/admin.service.spec.ts`, `apps/web/src/features/admin/pages/AdminDashboard.test.tsx`
  - Gap Test: replay traceability E2E

- [ ] **FR-S05 — Automatic Assignment — Partial**
  - มี user quest schema/query และ assignment behavior จาก generation workflow
  - Gap Test: duplicate assignment และ E2E visibility บนฐานข้อมูลจริง

- [ ] **FR-S06 — Deterministic Completion — Partial**
  - มี rule engine (`quest-evaluation.ts`) ที่พิสูจน์ completion จาก paid receipt หนึ่งใบและให้ reward ครั้งเดียว พร้อม unit tests (`quest-evaluation.spec.ts`, `quests.service.spec.ts`)
  - Gap Test: real PostgreSQL concurrent integration สำหรับ double reward

## Administrator Requirements

- [ ] **FR-A01 — Platform Overview — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/admin/overview` สรุปจำนวนผู้ใช้แยกตามบทบาท ร้านค้า คำสั่งซื้อที่ชำระสำเร็จ ยอดใช้จ่าย เงินอุดหนุน พอยต์ คูปอง ภารกิจ และโครงการเงินอุดหนุนที่เปิดใช้งานอยู่
  - UI: `AdminDashboard.tsx` (Blue Theme) แท็บภาพรวมแพลตฟอร์ม
  - Evidence: `apps/api/src/admin/admin.service.spec.ts`, `apps/web/src/features/admin/pages/AdminDashboard.test.tsx`
  - Gap Test: E2E ร่วมกับฐานข้อมูลสด

- [ ] **FR-A02 — Merchant Approval — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/admin/merchants`, `POST /api/v1/admin/merchants/:id/approve|reject|suspend|activate` พร้อมบันทึก Audit Event
  - UI: `AdminDashboard.tsx` แท็บอนุมัติร้านค้า
  - Evidence: `apps/api/src/admin/admin.service.spec.ts`, `apps/web/src/features/admin/pages/AdminDashboard.test.tsx`
  - Gap Test: E2E ร่วมกับฐานข้อมูลสด

- [ ] **FR-A03 — Admin Management — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/admin/users/admins`, `POST /api/v1/admin/users/:userId/roles/admin`, `PATCH /api/v1/admin/users/:userId/roles/admin` พร้อม Last-Active-Admin Protection
  - UI: `AdminDashboard.tsx` แท็บจัดการผู้ดูแล
  - Evidence: `apps/api/src/admin/admin.service.spec.ts`, `apps/web/src/features/admin/pages/AdminDashboard.test.tsx`
  - Gap Test: E2E ร่วมกับฐานข้อมูลสด

- [ ] **FR-A04 — Subsidy Program Management — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/admin/subsidy-programs`, `POST /api/v1/admin/subsidy-programs`, `PATCH /api/v1/admin/subsidy-programs/:id` โดยไม่เขียนทับธุรกรรมเดิม
  - UI: `AdminDashboard.tsx` แท็บโครงการเงินอุดหนุน
  - Evidence: `apps/api/src/admin/admin.service.spec.ts`, `apps/web/src/features/admin/pages/AdminDashboard.test.tsx`
  - Gap Test: E2E ร่วมกับฐานข้อมูลสด

- [ ] **FR-A05 — Quest Generation — Partial (Frontend & Backend Integrated)**
  - API: `POST /api/v1/admin/quests/generate` และ `GET /api/v1/admin/quest-generation-logs`
  - UI: `AdminDashboard.tsx` แท็บ AI สร้างภารกิจ รองรับการเลือกผู้บริโภคและสั่ง AI สร้างภารกิจพร้อมแสดงผลทันที
  - Evidence: `apps/api/src/quests/quests.controller.spec.ts`, `apps/api/src/admin/admin.service.spec.ts`
  - Gap Test: E2E ร่วมกับฐานข้อมูลสด

- [ ] **FR-A06 — Reward Monitoring — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/admin/rewards/monitoring` ติดตามการมอบหมายภารกิจ อัตราทำภารกิจสำเร็จ การออกพอยต์ การแลกคูปอง การใช้คูปอง และวันหมดอายุ
  - UI: `AdminDashboard.tsx` แท็บติดตามแต้ม/คูปอง
  - Evidence: `apps/api/src/admin/admin.service.spec.ts`, `apps/web/src/features/admin/pages/AdminDashboard.test.tsx`
  - Gap Test: E2E ร่วมกับฐานข้อมูลสด

- [ ] **FR-A07 — Social Impact Dashboard — Partial (Frontend & Backend Integrated)**
  - API: `GET /api/v1/admin/dashboard/social-impact` คำนวณ Active Consumers, Participating Merchants, Successful Orders, Total Final Spend, Total Subsidy Used, Average Sales per Merchant, Quest/Point/Coupon rates, Sales by Merchant & Category, Daily Trend (`Asia/Bangkok`) พร้อม `metricVersion`, `reportingTimezone`, และ `asOf`
  - UI: `AdminDashboard.tsx` แท็บผลกระทบทางสังคม
  - Evidence: `apps/api/src/admin/admin.service.spec.ts`, `apps/web/src/features/admin/pages/AdminDashboard.test.tsx`
  - Gap Test: E2E ร่วมกับฐานข้อมูลสด

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
