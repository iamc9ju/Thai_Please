# Customer Portal Performance ExecPlan

## Outcome

Customer Portal โหลดข้อมูลเร็วขึ้นอย่างวัดผลได้ โดยไม่มี request/query waterfall ที่ไม่จำเป็น ไม่มี request ซ้ำจาก Development StrictMode และไม่ลดความถูกต้องของ authentication หรือ wallet data

## Requirements

- `NFR-PERF-01`: proposed budget (รอ Product Owner ยืนยัน) สำหรับ warm `GET /api/v1/wallet/overview` p95 ไม่เกิน 1,000 ms จากอย่างน้อย 20 authenticated requests บน environment ที่บันทึกไว้
- Proposed budget (รอ Product Owner ยืนยัน) สำหรับ Customer primary data ภายใน 1,500 ms เมื่อ API/DB warm และรายงาน cold start แยก
- หนึ่ง logical page load ไม่ยิง `/users/me` หรือ `/wallet/overview` ซ้ำโดยไม่จำเป็น
- Independent database reads ใช้ bounded parallelism และคง query bounds เดิม
- `FR-C01`/`FR-C02`, authorization, session validation และ wallet/ledger invariants ต้องไม่เปลี่ยน
- Non-goals: ไม่ย้าย Neon region, ไม่เปลี่ยน ORM/framework, ไม่เพิ่ม cache infrastructure ภายนอก และไม่ลด security checks

## Current State

- Baseline จาก development database Neon `us-east-2`: first query ~3,262 ms, warm query ~270 ms, 8 sequential queries ~2,168 ms และ 8 parallel queries ~275 ms
- `AuthProvider` รอ `/users/me` ก่อน render dashboard; Development StrictMode สามารถเริ่ม effect ซ้ำ
- `ConsumerDashboard` โหลด overview และ `WalletView` โหลด overview ซ้ำเมื่อเปลี่ยนหน้า
- `WalletView` เรียก overview/history พร้อมกันแล้ว แต่ effects อาจซ้ำตอน dev mount
- `WalletService.getConsumerOverview` เดิมมี independent Prisma reads ที่ await เรียงกันประมาณ 8 รอบ; ปัจจุบันลดเป็น 3 bounded stages ที่ concurrency สูงสุด 3
- `AuthGuard` อ่าน session แล้ว await เขียน `lastUsedAt` ทุก protected request; รอบนี้รักษา behavior ไว้ก่อน เว้นแต่มีหลักฐาน/test รองรับการเปลี่ยน

## Invariants and Risks

- ห้าม cache ข้อมูลข้าม user/session หรือแสดงข้อมูล stale หลัง value movement
- การ deduplicate ต้องแชร์เฉพาะ in-flight request เดียวกันและต้องล้างเมื่อ settle; mutation ต้อง refresh/invalidate อย่างชัดเจน
- Parallel reads ต้องเริ่มหลังรู้ wallet identity เมื่อ query ต้องใช้ walletId และต้องไม่เปลี่ยน authorization scope
- Cold-start latency ของ hosted database ไม่สามารถแก้ทั้งหมดใน application code; ต้องรายงานแยกจาก warm path
- Performance test ต้องไม่ใส่ credential/PII ใน source หรือ logs

## Decisions

- เพิ่ม session-generation/exact-query in-flight request deduplication ใน API boundary แทนการถอด React StrictMode
- ส่ง overview พร้อม fetchedAt จาก Dashboard เข้า WalletView; reuse ตอนนำทางไม่เกิน 30 วินาที, revalidate เมื่อ stale และ force refresh หลัง top-up
- Backend อ่าน user/wallet พร้อมกัน แล้วแบ่ง downstream reads เป็นสองกลุ่ม กลุ่มละ 3 เพื่อป้องกัน cold connection burst
- ใช้ database aggregate สำหรับยอด subsidy แทนดึงทุกรายการมารวมใน Node.js
- ไม่เปลี่ยน Neon region ในรอบนี้ เพราะเป็น infrastructure operation แยกและต้องมี rollout decision

## Execution Steps

1. **Primary/docs — completed:** เพิ่ม `NFR-PERF-01`, baseline และ acceptance criteria
2. **Backend owner — completed:** refactor overview query orchestration/aggregate พร้อม bounded-concurrency regression tests
3. **Frontend owner — completed:** session-scoped dedupe, navigation reuse/stale revalidation, mutation invalidation และ StrictMode tests
4. **Primary integration — completed for application changes:** รวมงาน รัน full verification และวัด service latency กับฐานข้อมูลจริง; performance budget ยังไม่ผ่าน
5. **Independent review — completed:** พบและปิด stale/session/history/StrictMode code blockers; คง SLA/infra gaps เป็น residual

## Verification

- API wallet unit/controller/E2E tests และ tests ที่ยืนยัน independent reads เริ่มพร้อมกันโดยยังรอ wallet dependency เท่าที่จำเป็น
- Web tests ภายใต้ StrictMode ยืนยัน logical request เดียว และ Wallet reuse overview แต่ refresh หลัง top-up
- Full web/API tests, typecheck, lint, build และ changed-file formatting
- Read-only latency measurement เทียบ baseline; HTTP p95 ต้องใช้ authenticated test session โดยไม่ commit credential

ผลล่าสุด: service-level cold 7,465 ms; 20 warm samples min 1,383 ms, avg 1,429 ms,
p95 1,446 ms และ max 1,719 ms บน Neon `us-east-2`. ตัวเลขนี้ไม่รวม AuthGuard/HTTP/render
และยังไม่ผ่าน proposed 1,000 ms endpoint budget.

## Rollout and Recovery

- เป็น behavior-preserving application refactor ไม่มี schema migration
- หาก parallel orchestration ทำให้ test/data contract เปลี่ยน ให้ revert เฉพาะ orchestration และคงเอกสาร requirement เปิดไว้
- หาก in-flight cache พบ cross-session/stale risk ให้ปิด cache และคงการส่ง initial overview แบบ component ownership
- Neon region/pooling/autosuspend เป็น follow-up infrastructure decision หาก cold start ยังเกินเป้าหมาย

## Progress Log

- 2026-10-15: ตรวจ source flow พบ `/users/me` -> `/wallet/overview` waterfall, StrictMode duplicate risk, Wallet overview reload และ sequential database reads
- 2026-10-15: วัด Neon development database ได้ first query ~3,262 ms, warm RTT ~270 ms, sequential 8 queries ~2,168 ms, parallel 8 queries ~275 ms
- 2026-10-15: เพิ่ม requirement/checklist/ExecPlan และแบ่ง ownership backend/frontend
- 2026-10-15: Backend รุ่น parallel 6 พบ live `ETIMEDOUT`; รุ่น max concurrency 2 ผ่านแต่ warm service p95 1,713 ms จึงปรับเป็น bounded max 3
- 2026-10-15: รุ่น max concurrency 3 วัดได้ cold 7,465 ms และ warm service p95 1,446 ms จาก 20 samples โดยไม่ timeout
- 2026-10-15: Frontend เพิ่ม session-scoped in-flight dedupe สำหรับ `/users/me`, overview และ history; navigation reuse 30 วินาที, stale revalidation และ mutation invalidation พร้อม StrictMode tests
- 2026-10-15: Verification ผ่าน API unit 74/74, API E2E 2/2, Web 52/52, typecheck/lint/build และ changed-file formatting
- 2026-10-15: Independent review ปิด code blockers แล้ว แต่ NFR ยัง In progress เพราะ authenticated HTTP/page target และ infrastructure latency ยังไม่ผ่านหลักฐาน

## Open Questions

- ยังไม่มี authenticated HTTP benchmark session สำหรับวัด p95 end-to-end; ใช้ session ชั่วคราวที่ไม่บันทึก credential ลง source เมื่อพร้อม
- Product Owner ต้องยืนยันหรือปรับ proposed budgets 1,000/1,500 ms และ navigation reuse window 30 วินาที
- การลด `/users/me` -> overview waterfall, ลด awaited session-touch write และการย้าย Neon ไป region ใกล้ผู้ใช้/ปรับ pooling-autosuspend เป็นงานถัดไปเพื่อให้ถึง budget
