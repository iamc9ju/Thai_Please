# คู่มือเควส v3: AI เสนอและผู้ใช้เลือก

แทน automatic ranking v2 เมื่อ deploy โค้ดและ migration ชุดนี้พร้อมกัน ดู [แบบการออกแบบ](QUEST_PROPOSALS_DESIGN_TH.md) และ [ExecPlan](../../.agent/plans/quest-proposal-selection.md)

## ค่าเริ่มต้นที่ใช้

- Gemini เสนอสูงสุด 3 ข้อ Backend ตรวจ schema/type/category/ยอดบวกหน่วย10บาท/ความซ้ำ แสดง1–2ข้อได้หากเติมไม่ครบ เรียกไม่เกิน2ครั้งต่อชุด ไม่มี hidden network retry
- ไม่มีเพดานธุรกิจ100บาท มีเฉพาะขอบเขตการแทนค่า Decimal(12,2) ใช้ integer satang ข้าม AI boundary
- ชุดอายุ24ชั่วโมง ใช้ชุดเดิมก่อน สร้างสูงสุด3ชุดต่อวันไทย พัก15นาทีเมื่อ generationล้มเหลว ไม่มีปุ่มสุ่มใหม่ขณะREADY
- เลือก1ข้อจึงเริ่ม assignment7วันและรอบรับ7วัน ได้20พอยต์เท่ากันทั้งสองประเภท พอยต์อายุ90วัน งบจองรายวัน2,000และค้าง14,000พอยต์
- สรุปซื้อ30วัน ประวัติเควส90วัน/latest10 ค่าเฉลี่ย/มัธยฐานใช้minor unitsและปัดเศษต่ำกว่าสตางค์ลง ส่งdistributionและสถิติแยกหมวด
- บิลเงินส่วนตัวเป็นบวกน้อยกว่า3บิลให้เลื่อนด้วย INSUFFICIENT_HISTORY ไม่แต่งข้อมูล
- เงินส่วนตัวมาจาก orders.user_paid_amount ไม่รวมsubsidy จัดสรรส่วนลดจากgrossลงรายการด้วยlargest remainder แล้วจัดสรรpersonalจากnet itemsอีกครั้ง ใช้ฟังก์ชันเดียวกันในsummary/completion
- ใช้snapshot category และproportionate attribution ไม่อ้างว่าผู้ใช้เลือกแหล่งเงินรายสินค้า เก็บUTC/expiry exclusive แสดงเวลาไทย

แก้ค่าที่ `apps/api/src/quests/config/quest-policy.json` ต้องbump versionเมื่อเปลี่ยนความหมายและrestartทุกinstanceด้วยpolicyเดียวกัน ชุดpolicyไม่ตรงเลือกไม่ได้ Assignmentที่มอบแล้วเก็บamount basis/rule version/next eligibleของตัวเอง

## API และ lifecycle

### สวิตช์ทดสอบ rate limit

ตั้ง `QUEST_GENERATION_RATE_LIMIT_ENABLED=false` ใน `apps/api/.env` แล้ว restart Backend เพื่อปิดเฉพาะเพดานชุดต่อวันและคำขอจาก actor ต่อนาที ใช้ได้ใน development/test เท่านั้น production บังคับเปิดเสมอ ค่าเริ่มต้นคือ `true`; ทดสอบเสร็จเปลี่ยนกลับ `true` แล้ว restart ไม่เปลี่ยน policy snapshot จึงไม่ทำให้ชุด READY เดิมผิดรุ่น ไม่ข้าม active/cycle, existing set, failed cooldown, budget หรือ provider quota

Consumer routesใช้session CONSUMERและตัวตนจากsession Mutationต้องJSONพร้อมOriginในCORS_ORIGINS

| Method | Path หลัง API prefix                          | พฤติกรรม                                                                         |
| ------ | --------------------------------------------- | -------------------------------------------------------------------------------- |
| GET    | /consumer/quests                              | assignment/ประวัติ พร้อมamountBasis                                              |
| GET    | /consumer/quests/proposals                    | อ่านสถานะ ไม่เรียกprovider                                                       |
| POST   | /consumer/quests/proposals                    | body {idempotencyKey:UUIDv4}; queueแล้วตอบ202                                    |
| POST   | /consumer/quests/proposals/:requestKey/select | body {proposalId,idempotencyKey:UUIDv4}; เลือกแล้วตอบassignmentId,nextEligibleAt |
| POST   | /admin/quests/generate                        | adminสร้างชุดให้consumerทดสอบ ยังต้องเลือกก่อนมอบ                                |

สถานะ ELIGIBLE/PENDING/READY/COOLDOWN/FAILED; nextEligibleAtอาจเป็นเวลารอบใหม่หรือเวลาลองใหม่ตามreason ไม่ใช่7วันเสมอ Frontendpoll PENDINGแบบจำกัด การเลือกretryใช้keyเดิม ถ้าresponseหาย/remountให้อ่านสถานะก่อน

## Worker และ recovery

ไม่เพิ่มqueue service ใช้quest_generation_logsเป็นdurable PostgreSQL queueของquests module Workerpollทุก2วินาที ครั้งละ1jobต่อinstance Claimในtransaction/advisory lockแล้วปล่อยก่อนเรียกGemini

- Queued jobsอยู่ต่อหลังrestartและถูกclaimได้
- worker_started_atกันclaimซ้ำ; lease120วินาที หากงานที่เริ่มแล้วขาดผลจนหมดleaseจะFAILED/LEASE_EXPIRED ไม่replay providerไม่จำกัด
- Queue waitนับรวมในlease งานอาจหมดleaseภายใต้load ต้องติดตามpending/lease failuresและเพิ่มcapacityจากข้อมูลจริง
- Shutdownหยุดclaimและรอjobปัจจุบันภายใต้provider timeout; force killใช้lease recovery
- สร้างล้มเหลวไม่เสียรอบ ไม่ออกพอยต์ Selectionตรวจownership/catalog/policy/budgetและจองในtransactionเดียว
- ดูevents quest_proposals_finished/quest_proposals_failed/quest_worker_failed/quest_completedกับaudit logs ห้ามlogkey/token/sessionหรือraw private provider errors
- Catalog/policyเปลี่ยนระหว่างรอเลือกต้องอ่านสถานะใหม่ ห้ามแก้stored JSONด้วยมือ

## Deploy และ migration

1. หยุดAPI/worker v2 สำรองและตรวจtarget ใช้controlled migration window
2. รัน `pnpm --filter @thai-please/api db:migrate:deploy`
3. รัน `pnpm --filter @thai-please/api db:generate` แล้วbuild/deploy APIและwebรุ่นใหม่พร้อมกัน
4. ตั้งGEMINI_API_KEY/GEMINI_MODELฝั่งBackendเช่นเดิม ไม่ส่งkeyให้frontend
5. ทดสอบconsumerที่มีประวัติ: PENDING→READY→เลือก→ACTIVE→PAID→พอยต์ครั้งเดียว

Migration `20261028090000_quest_proposals_personal_spend` เพิ่มคอลัมน์บนtablesเดิม ไม่เพิ่มquest_generation_runs:

- quests: amount_basis,rule_version
- user_quests: next_eligible_at พร้อมindex/check
- quest_generation_logs: worker_started_at,generated_proposals,proposal_expires_at,selected_proposal_id,selection_key(unique) และchecksรองรับREADY

DDL/UPDATEมีlocks มีUPDATEยกเลิกเฉพาะlegacy ACTIVEที่ยังไม่หมดอายุพร้อมเหตุผล PERSONAL_SPEND_POLICY_V3 หากพบrewardกับactiveขัดแย้งจะหยุดให้อudit ประวัติCOMPLETED/EXPIREDและpoint ledgerไม่เปลี่ยน PENDINGเก่าFAILED/POLICY_CHANGED Legacyที่ยกเลิกไม่ล็อกรอบใหม่

Recoveryใช้roll-forward ไม่ลดschema ไม่เปิดworkerเก่า ไม่reactivateเควสที่ยกเลิกอัตโนมัติ ไม่ต้องรันseedเพื่อเปิดเควสใหม่; seedไม่มอบเควสหรือสร้างfake generation logsแล้ว

Validation queries (read-only):

```sql
SELECT status, count(*) FROM quest_generation_logs GROUP BY status;
SELECT count(*) AS unexpected_legacy_active
FROM user_quests uq JOIN quests q USING (quest_id)
WHERE uq.status = 'ACTIVE'
  AND (uq.expires_at AT TIME ZONE 'UTC') > now()
  AND q.amount_basis = 'FINAL_AFTER_DISCOUNT';
SELECT count(*) AS duplicated_rewards FROM (
  SELECT user_quest_id FROM point_transactions
  WHERE transaction_type = 'QUEST_REWARD' AND user_quest_id IS NOT NULL
  GROUP BY user_quest_id HAVING count(*) > 1
) duplicates;
```

สองcountท้ายต้อง0 หากไม่เป็นให้หยุดgenerationและตรวจaudit ห้ามแก้ledgerเงียบ ๆ
