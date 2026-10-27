# Backend เควสและ Gemini

สถานะ: มีตัวสรุปประวัติ ตัวสร้าง candidate, Gemini REST adapter, Admin generate และ Consumer list พร้อม generation-run audit/transactional reservation. มีหน้า Consumer แสดงเควสและตรวจ completion/ออกแต้มหลัง PAID แล้ว; ยังไม่เปิดงานเวลา 08:00. เปลี่ยนแนวทาง online จาก CatBoost เป็น Gemini ranking ตามผู้ใช้สั่ง ไม่ใช้ model artifact และไม่อ้าง probability; ไฟล์แผน CatBoost เก่าเป็นบริบทเดิม ไม่ใช่คู่มือ online flow นี้

## เริ่มใช้งาน

1. สำรอง development DB ตาม workflow ของคุณ แล้วใช้ `pnpm --filter @thai-please/api db:migrate:deploy` เพื่อใช้ additive migration ที่ตรวจแล้ว (agent ไม่ได้ apply migration เข้า schema แอปจริงให้)
2. ตั้ง `GEMINI_API_KEY` และ `GEMINI_MODEL` คู่กันใน server environment. เลือกรุ่นที่รองรับ structured output และตรวจโควตาจาก Google AI Studio. ไม่ส่ง key ในแชตหรือหน้าเว็บ. ไม่ตั้งทั้งคู่ยังเปิด API ได้ แต่ generation จะบันทึก FAILED อย่างปลอดภัย
3. ตั้ง `GEMINI_TIMEOUT_MS` (1,000–30,000; default 15,000). `CORS_ORIGINS` ต้องรวม origin ของหน้า Admin. Config กลยุทธ์เควสอยู่ `apps/api/src/quests/config/quest-policy.json` และถูกบรรจุใน Nest build. กระบวนการที่ deploy ด้วย Docker ต้องรับ environment เดียวกันและเข้าถึง Google API ได้
4. เริ่ม API ตามคำสั่งเดิมของโปรเจกต์ แล้ว login ด้วย session ของ Admin. ไม่สร้าง bypass token หรือ endpoint สาธารณะ

## API

`POST /api/v1/admin/quests/generate` (prefix ตาม environment): active ADMIN session cookie, header `Content-Type: application/json`, `Origin` ตรง allow-list. Body:

```json
{
  "userId": "1",
  "idempotencyKey": "0d44cb43-ae77-41bd-a95a-60d361452073"
}
```

สร้าง UUID v4 ใหม่สำหรับงานใหม่ และใช้ค่าเดิมสำหรับ retry ของงานเดิม. ไม่ใช้ UUID ตัวอย่างซ้ำทุกงาน. ตอนสำเร็จคืน requestKey/status=ASSIGNED/assignmentId. อาจคืน PENDING เมื่ออีก worker กำลังทำงาน, DEFERRED พร้อม reason (ข้อมูลไม่พอ/active/daily/budget/catalog เปลี่ยน), หรือ FAILED เมื่อ provider/config/output ผิด. HTTP response ไม่ได้แปลว่ามอบสำเร็จจนกว่า status เป็น ASSIGNED. เมื่อ lease 120 วินาทีหมด retry key เดิมจะ terminalize เป็น FAILED/LEASE_EXPIRED; งานใหม่ใช้ key ใหม่ ไม่ต่อ lease เก่า

`GET /api/v1/quests?cursor=<assignmentId>`: Consumer session เท่านั้น อ่านเฉพาะ session owner; ไม่รับ userId. คืน items สูงสุด 20 และ nextCursor; คืน empty array ได้. เงินเป็น integer minor-unit strings, IDs เป็น strings, timestamps ISO UTC. ไม่มี HTML หรือข้อความจาก Gemini ส่งให้ browser. UI ต้องใช้ typed localization ตาม quest type และแสดง condition/reward/status/expiry

## กระบวนการ

อ่าน PAID ของผู้ใช้ใน `[asOf-30d,asOf)` และ snapshot line amounts → exact bigint allocation ของยอดสุทธิแบบ proportional largest remainder (tie ด้วย item ID numeric) → สถิติ 7/30 วัน → candidate ตาม policy → กรองซ้ำ/cooldown → ส่งเฉพาะ aggregates ที่เกี่ยวข้องและ candidate ให้ Gemini. รายการ target ที่ไม่เกี่ยวข้องถูกตัดออกก่อนออกเครือข่าย. ไม่มีชื่อ/เบอร์/เลขบัตร/credentials/ประวัติการเงินดิบส่งออก

ก่อนเรียก AI จองสิทธิ์และแต้มใน `quest_generation_logs` โดย global advisory transaction lock; ขณะรอ AI ไม่ถือ DB lock. Timeout/429/5xx/network errors retry ไม่เกิน policy (default 2), invalid response/4xx ไม่ retry. Parse strict schema และต้องได้ ID ครบ ไม่มีซ้ำ/ปลอม. คะแนนเป็น suitability 0–100 ไม่ใช่ probability. Tie ใช้ยอดต่ำแล้ว canonical candidate ID

ก่อนมอบตรวจ consumer/catalog/active/daily/duplicate/budget อีกครั้ง ตรวจ candidate และ policy ตรง immutable claim snapshot แล้วสร้าง Quest/UserQuest กับ audit update ใน transaction เดียว. Legacy assignments ยังนับเข้าข้อจำกัดและ budget ด้วย. Policy snapshot เก็บ expiry/reward rules สำหรับการตรวจภายหลัง ไม่แก้เควสเดิมย้อนหลัง

ทุก assignment writer ใหม่ (scheduler/worker/import) ต้องใช้ primitive claim/finalize นี้และ advisory lock เดียวกัน. PostgreSQL constraints บังคับ run uniqueness, assignment uniqueness, FKs และสถานะ แต่ dynamic active/day/budget limits ต้องผ่าน transaction primitive นี้ ไม่อนุญาต direct insert bypass. ระหว่าง rollout ต้องหยุด legacy writer ที่ไม่ใช้ primitive นี้

Audit ของงานใหม่ใช้ `quest_generation_logs` เดิม โดยขยาย generated_quest_id ให้ nullable เพื่อเก็บ failure/pending ก่อนมี Quest ID ได้. ใช้ generated_at, candidate_scores และ selection_reason เดิมต่อ เก็บ generation_id และ log เก่าไว้ครบ (status LEGACY). เก็บ request key เป็น correlation, actor/target, provider/model/prompt/policy versions, snapshot, summary, candidates, output, result/reason, timestamps และ assignment link. ไม่มี provider raw errors/secret ใน log. PENDING reservation หมดตาม lease; ASSIGNED reservation ปลดเมื่อ assignment หมดอายุหรือพ้น ACTIVE โดยไม่ลบ point ledger

History/catalog/prior query จำกัด 5,000 รายการ ถ้ามากกว่านั้นปฏิเสธด้วย machine code ไม่ตัดข้อมูลเงียบ. Average summary แสดง integer minor units ปัดลงเพื่อ presentation เท่านั้น; threshold ใช้ total/count rational โดยตรงแล้ว ceil ไม่ใช้ rounded summary. ข้อมูลผิด invariant จะ fail ไม่ fabricate success

## Migration / operations

ขยาย table quest_generation_logs เดิมด้วย nullable metadata และ indexes; ไม่สร้าง table ซ้ำ ไม่ลบ log เดิม. Existing rows รับ status LEGACY โดยไม่เดา model/policy/actor ของอดีต. ALTER TABLE ต้องถือ lock ระยะสั้น ควรใช้ rollout window ตามปริมาณตาราง. ใช้ migration ก่อนเปิด generation, verify ด้วย `SELECT to_regclass('quest_generation_logs');`. ตรวจ lease ค้างด้วย `SELECT status, count(*) FROM quest_generation_logs GROUP BY status;`. ปัญหา 429 ให้ลดการสั่งสร้างและดูโควตา ไม่ยิง retry ไม่จำกัด. Failed/Deferred ไม่สร้าง assignment/points. Revert application ได้โดยเก็บคอลัมน์ audit ที่เพิ่มไว้ ไม่ drop ข้อมูลจริง

API prefix/role guards ยึดระบบเดิม. Generation ใช้ UUID idempotency, trusted Origin + JSON สำหรับ cookie mutation. ยังต้องมี production ingress rate limiting ตามแผน deployment; ไม่เปิด endpoint นี้ให้ Consumer. ยังไม่มี scheduler และ UI ปุ่ม Admin ในงานนี้

## Verification / traceability

- FR-S01: pure summary/candidate tests และ PostgreSQL ownership/time-window tests
- FR-S02/03: provider schema/coverage, errors, timeout และ exact conditions; HTTP rejects extra fields/untrusted origin
- FR-S04: migration/audit snapshot, failure result และ selected-candidate snapshot check
- FR-C07/FR-S05/FR-A05: Admin generation, automatic assignment, owner-only read, idempotency/concurrency/budget/lease integration tests
- FR-S06/BR-POINT: evaluator ตรวจสองประเภทหลัง PAID และออกแต้มใน transaction; PostgreSQL tests ยืนยันข้ามร้านและ concurrent retry ไม่ออกซ้ำ. รอบอัตโนมัติยังไม่เปิด

DB tests opt-in: PowerShell `$env:QUEST_RUN_DATABASE_TESTS='1'` แล้ว `pnpm --filter @thai-please/api test -- src/quests/quests.repository.integration.spec.ts`. ใช้ `QUEST_TEST_DATABASE_URL` ถ้ามี มิฉะนั้น DATABASE_URL จาก environment/.env; สร้าง random schema ใช้ migrations/fixtures เฉพาะ schema นั้น แล้วลบทิ้ง ไม่ query ข้อมูลส่วนตัวเดิม. ต้องใช้บัญชี development ที่อนุญาตสร้าง schema. Migration ถูกทดสอบบน schema ว่าง ไม่ได้ apply ใน schema แอปจริง

ยังไม่ได้ยิง Gemini จริง/ประเมินคุณภาพกับข้อมูลสมชาย เพราะไม่มีการกำหนด model/key สำหรับการทดสอบสด. Provider tests ใช้ HTTP mock และ DB integration tests ใช้ PostgreSQL จริงคนละชั้น ไม่อ้าง mock แทน transaction

อ้างอิง protocol: https://ai.google.dev/api/generate-content และ https://ai.google.dev/gemini-api/docs/structured-output

## Policy v2: เหลือสองประเภท (27 ตุลาคม 2026)

Generation รับเฉพาะ MIN_SPEND/CATEGORY_SPEND ซื้อข้ามร้านได้ ไม่มี product/name matching หรือ merchant-only condition. รวมไม่เกิน 8 ตัวเลือก (4 ต่อประเภท). Provider payload ตัดสถิติสินค้า/ร้านที่ไม่เกี่ยวข้อง; หมวดกลางใช้ category ID. Completion ตรวจหนึ่ง PAID Order หลังส่วนลดและ category snapshot ไม่ใช้ชื่อสินค้า.

Migration `20261027090000_retire_product_merchant_quests` เพิ่ม cancellation metadata และยกเลิก ACTIVE legacy PRODUCT_PURCHASE/MERCHANT_SPEND ที่ยังไม่หมดอายุ พร้อม reason QUEST_TYPE_RETIRED_POLICY_V2 โดยไม่ลบหรือแก้ประวัติสำเร็จ/แต้ม. API list คืน CANCELLED/cancelledAt/cancellationReason เพื่อแสดงในประวัติ. ไม่คืนโควตารายวันย้อนหลัง ไม่มอบเควสใหม่อัตโนมัติ. หยุด worker เก่า → apply migration → restart; agent ไม่ apply กับฐานข้อมูลแอปจริง. Constraint NOT VALID บน quests รักษาแถวเก่าแต่บังคับทุก insert/update ใหม่ให้เป็นกฎสองแบบ ไม่มี product/merchant binding; ไม่ VALIDATE constraint จนกว่าจะมีแผน archive ประวัติเก่า.
