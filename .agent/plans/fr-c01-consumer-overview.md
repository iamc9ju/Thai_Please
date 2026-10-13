# FR-C01 Consumer Overview ExecPlan

## Outcome

Customer ที่เข้าสู่ระบบเห็นหน้า Overview จากข้อมูลจริงของตนเอง ได้แก่ข้อมูลประจำตัวแบบปกปิดยอด Personal/Subsidy/Point สถานะ Subsidy รายวัน Quest Coupon และ Paid Order ล่าสุด โดยไม่มีข้อมูล Mock ในเส้นทางใช้งานจริง

## Requirements

- Requirement: `FR-C01`, สนับสนุนข้อมูลจาก `FR-C03` ที่แสดงบน Overview และ `NFR-UX-01`, `NFR-ACC-01`, `NFR-I18N-01`
- API ต้องบังคับ Consumer authorization และ query เฉพาะ `userId` จาก session
- Frontend ต้องมี loading, error พร้อม retry, empty และ success states
- Overview ต้องใช้ API จริงและไม่เปลี่ยนพฤติกรรม Top-up, Payment, Quest, Point หรือ Coupon
- Non-goals: ทำ FR-C02-FR-C09 ให้สมบูรณ์, เปลี่ยน schema/migration, เพิ่ม dependency หรือ redesign ทั้ง portal

## Current State

- `GET /api/v1/wallet/overview` เป็น read-only และคืน balances, active program, assigned quests, available coupons, wallet transactions และ Paid Orders ล่าสุด
- `ConsumerOverview` เรียก API จริงและไม่ใช้ `consumerMock`
- Header ใช้ข้อมูลผู้ใช้จาก authenticated session และ mask Citizen ID
- Frontend แสดงจำนวนเงินจาก API เป็น integer baht โดยไม่หาร 100

## Invariants and Risks

- Consumer ต้องอ่านได้เฉพาะข้อมูลของตนจาก `req.user.userId`
- ห้ามเปิดเผย Citizen ID เต็มใน Overview หรือ log
- จำนวนเงินจาก API เป็น integer baht; ห้ามแปลงเป็น binary fractional money หรือหาร 100 แบบข้อมูล Mock
- Query รายการล่าสุดต้อง bounded และเลือกเฉพาะ Paid Orders ของ consumer
- การโหลดล้มเหลวต้องไม่แสดง mock เป็นข้อมูลจริงหรือ success-shaped fallback
- รักษา accessibility และ typed Thai localization

## Decisions

- ใช้ `/wallet/overview` เป็น aggregate endpoint สำหรับ FR-C01 ในรอบนี้ และเพิ่ม `recentOrders` แบบ additive
- ใช้ session user ที่มีอยู่สำหรับชื่อและ Citizen ID แบบ mask; ไม่เพิ่ม PII ใน wallet response
- Frontend page เป็นเจ้าของ remote state และส่ง typed overview data ลง view
- เก็บ mock file ไว้เฉพาะหน้าที่ยังไม่อยู่ใน scope แต่ Overview ห้าม import mock
- Overview GET ไม่สร้าง Wallet หรือ assign Quest; workflow assignment เป็นความรับผิดชอบของ FR-C07
- ใช้ Bangkok business date สำหรับ PostgreSQL `DATE` และช่วงธุรกรรมแบบ half-open `[start, nextDay)`

## Execution Steps

1. **Backend API — engineer/Level 2 (complete):** เพิ่ม Paid Order ล่าสุดแบบ bounded, ทำ Overview read-only, แก้ Bangkok date boundaries และเพิ่ม service/controller tests
2. **Frontend Integration — engineer/Level 2 (complete):** เรียก overview API, เพิ่ม loading/error/retry/empty/permission-denied และแสดงข้อมูลจริงด้วยหน่วยเงินที่ถูกต้อง
3. **Integration Review — primary/Level 3 (complete):** ตรวจและแก้ contract, privacy, authorization, money semantics และ permission-denied flow
4. **QA — reviewer/Level 3 (in progress):** ตรวจผลแก้ blockers รอบสุดท้ายและออก verdict

## Verification

- API unit tests: owner scoping, balances/program/quests/coupons, no orders, latest paid orders ordering/limit
- Web tests: loading, success from API, empty collections, API error and retry, no mock value leakage
- Run API and web targeted tests, workspace typecheck, lint, format check and production builds
- Manual/static check: masked Citizen ID, no cross-user input, Thai copy from localization, semantic live state

## Rollout and Recovery

- Contract changeเป็น additive จึงรองรับ client เดิม
- ไม่มี schema migration และไม่มี data backfill
- Roll back ได้โดยถอด `recentOrders` mapping และ frontend integration โดยไม่แตะข้อมูลถาวร

## Progress Log

- 2026-10-14: ตรวจ Requirement และ current implementation; พบ Overview ยังใช้ mock และ API ขาด recent Paid Orders
- 2026-10-14: กำหนด contract additive และแยก ownership Backend/Web/QA
- 2026-10-14: Backend/Frontend implementation รอบแรกผ่าน tests แต่ QA ไม่อนุมัติจาก concurrency, Bangkok date, privacy และ authorization coverage gaps
- 2026-10-14: แก้ Overview ให้ read-only, ใช้ Bangkok business date และ half-open day interval, ลด PII query, เพิ่ม 401/403/cross-user tests และ permission-denied UI
- 2026-10-14: Web tests 17/17, API tests 26/26, API E2E 1/1, typecheck/lint/build ทั้งสอง workspace และ changed-file Prettier ผ่าน

## Open Questions

- ไม่มีคำถามที่ block FR-C01; รายละเอียด Profile เต็มจะจัดการในหน้าข้อมูลส่วนตัว ไม่ส่ง PII เพิ่มผ่าน wallet endpoint
