# แผนการพัฒนาระบบ AI — Personalized Quest Recommendation

## แผนลำดับงานและความคืบหน้า

ปรับวันที่ 15 ตุลาคม 2026 ตามที่ผู้ใช้อนุมัติ: ใช้ Complete Journey, เป้าเป็นสัดส่วนยอดเฉลี่ย, หมวดกว้าง department และชุดทดลองก่อน **วันนี้ทำถึงขั้น 3 ไม่ไปขั้น 4**

- ขั้น 1: Python 3.14.3 และ libraries เดิมพร้อมอยู่แล้ว
- ขั้น 2: [contract ใหม่](docs/ai/COMPLETE_JOURNEY_PREPARATION.md) มี 8 features และ observed purchase-match label พร้อม [นโยบายเทมเพลต](ai-service/config/quest_template_policy_v2.json)
- ขั้น 3: [โปรแกรม](ai-service/prepare_complete_journey.py) สร้าง pilot 1,664 samples (label 1 = 163, label 0 = 1,501) จากสูงสุด 3,200 ก่อนกรอง ครบ 4 ประเภทและทั้งสอง labels ในแต่ละประเภท
- ขั้น 4–9: ยังไม่พัฒนา ไม่มีโมเดล API NestJS adapter DB seed หรือการออกแต้ม

ข้อมูล synthetic-v1 เดิม 60 users, 2,228 Paid Orders, 540 assignments, 496 finalized rows (171/325) และ 20 features เก็บแยกเป็น legacy fixture Tests เดิม 25 รายการเป็นหลักฐานชุดจำลอง ไม่ใช่ผลประเมินโมเดลใหม่

อ่านคู่กับ [แผนภาษาอังกฤษ](AI_IMPLEMENTATION_PLAN.md), [roadmap](docs/AI_BEGINNER_ROADMAP_TH.md), [audit](docs/ai/COMPLETE_JOURNEY_DATASET_AUDIT.md) และ [manifest pilot](ai-service/data/complete_journey_pilot/manifest.json)

## 1. ภาพรวมโครงการ

ไทยช่วยไทยพลีสเป็นต้นแบบร้านค้ารายย่อย POS กระเป๋าเงินจำลอง เงินอุดหนุน เควส แต้ม และคูปอง AI ให้คะแนน candidate quests จากเทมเพลต แล้ว NestJS เลือกและมอบให้ผู้ใช้

คะแนนปัจจุบันหมายถึง **โอกาสเกิดการซื้อที่ตรงเงื่อนไขในหนึ่งบิลตามพฤติกรรมที่สังเกตได้** ไม่ใช่ผลตอบสนองต่อเควสจริง เพราะ source ไม่มีการมอบเควสหรือผลของแต้ม ไม่อ้าง causal uplift หรือ engagement เพิ่มขึ้นจากข้อมูลนี้ AI ไม่สร้างข้อความอิสระ ไม่ตรวจ completion และไม่ออกแต้ม

## 2. เทคโนโลยีที่ใช้

Python, CatBoostClassifier, Pandas/NumPy, scikit-learn, FastAPI/Pydantic/Uvicorn, NestJS/TypeScript, PostgreSQL/Prisma และ REST ตามเดิม ไม่เปลี่ยนโมเดลหรือ Database Schema

ตัวอ่าน R ใช้ pyreadr แยกในโฟลเดอร์ audit กับ bundled Python 3.12; venv 3.14 เดิมใช้ core/tests ได้ ไม่ติดตั้ง binary reader ที่ผิดเวอร์ชันเข้า venv

## 3. ขอบเขตหน้าที่ของ AI

AI รับ features/candidate conditions และคืน purchase_match_probability รองรับ offline training/versioning ภายหลัง ไม่เขียน DB ไม่มอบเอง ไม่จ่ายเงิน ไม่ตรวจสิทธิ์ ไม่ทำ completion/reward/coupon และไม่ retrain ทุก transaction

NestJS เป็นเจ้าของ eligibility, template generation, validation, selection, assignment และ log

## 4. ประเภทเควสที่รองรับ

| ประเภท           | กฎ                                               |
| ---------------- | ------------------------------------------------ |
| MIN_SPEND        | ยอดครบในหนึ่งบิล                                 |
| CATEGORY_SPEND   | ยอดหมวดเป้าหมายครบในหนึ่งบิล                     |
| PRODUCT_PURCHASE | มีสินค้าเป้าหมายในหนึ่งบิล ไม่มี min spend เพิ่ม |
| MERCHANT_SPEND   | ร้านเป้าหมายและยอดครบในหนึ่งบิล                  |

Template mechanics ใช้ JSON policy version เดียวกันในการเตรียมข้อมูลและ NestJS ภายหลัง: 1.0/1.5 × average ทั้งบิลย้อนหลัง 30 วัน, duration 7 วัน และ ceil threshold เป็น minor unit ก่อนคำนวณ ratio ค่าเหล่านี้เป็น offline experiment ไม่ใช่ production reward/eligibility policy ที่อนุมัติแล้ว

## 5. แหล่งข้อมูล

Complete Journey 2.0 แบบหนึ่งปีจาก pinned revision ใช้ transactions.rds เต็มและ products.rda มี 2,469 households / 155,848 baskets / 1,469,307 item rows

ใช้ department เป็นหมวดกว้าง (metadata 32 กลุ่ม) รหัสต้นทางและ dollars อยู่ metadata ไม่ให้โมเดลจำหรือแปลงเป็นบาทอัตโนมัติ sales_value เป็น retailer-revenue basis ไม่ยืนยันเท่ากับ final payable หลังส่วนลดของเว็บ วันที่/วินาทีผ่านการแปลงและ product metadata ไม่ยืนยัน historical snapshots ครบ

ไม่ต้อง import ทั้ง dataset เข้า DB เพื่อฝึก Live inference ภายหลังอ่านข้อมูลจาก Prisma ตรวจ schema/migrations จริงก่อนเขียน Product ของ source ไม่ใช่ Product ของเว็บที่ผูก merchant โดยตรง

## 6. รูปแบบปัญหา Machine Learning

หนึ่ง sample = household + UTC cutoff + hypothetical candidate

- Label 1: มีหนึ่ง observed basket ของเจ้าของตรงเงื่อนไขใน [cutoff,expires_at)
- Label 0: ไม่พบและช่วงติดตามครบ
- ช่วงไม่ครบ มี source gap หรือ rejected future basket: ไม่มี label และไม่นำเข้า CSV

ไม่รวมหลายบิลและไม่เรียก actual quest completion ถ้าใช้ผลเควสจริงในอนาคตต้อง version dataset/target แยก ใช้เฉพาะ finalized outcomes ไม่เอา ACTIVE/PENDING เป็น 0

## 7. การออกแบบ Features

Ordered schema purchase-match-features-v2 มี 8 ตัว: purchases_7d, purchases_30d, target_category_purchases_30d, target_merchant_purchases_30d, target_product_purchases_30d, quest_type, min_spend_ratio และ duration_days

สูตร/type/null อยู่ [contract](docs/ai/COMPLETE_JOURNEY_PREPARATION.md) Counts นับ distinct baskets; ไม่มี target เป็น null ไม่ใช่ 0 ข้อมูลซื้อใช้ก่อน cutoff ตัวเลือกตั้งก่อนดูอนาคต

ตัด quest-history 5 ตัวและ reward predictor ที่ source ไม่มีข้อมูลรองรับ Raw amounts/gap และ target IDs ไม่เข้าโมเดลเพื่อลด currency/catalog mismatch Backend ยังใช้ actual quest history สำหรับ eligibility/dedup

## 8. การเตรียม Training Dataset

อ่าน source → validate hashes → normalize/reject ทั้ง basket → สุ่ม 200 households จากข้อมูลก่อน cutoff แรก → 4 cutoffs × 4 types → features จากอดีต → labels จากช่วงถัดไป → export

สูงสุด 3,200 ก่อนกรอง ไม่ backfill โดยเลือกผลอนาคต ชุดปัจจุบัน 1,664 แถว แต่ product positives น้อย ต้องประเมิน coverage ก่อนขยาย/ฝึก ไฟล์ CSV/schema/policy/preview/exclusions/manifest อยู่ data/complete_journey_pilot แยกจาก legacy

## 9. การฝึกและประเมินโมเดล — งานภายหลัง

วันนี้ไม่ฝึก ขั้น 4 จึงตรวจ schema แยก X/y/metadata แบ่งตามเวลา เก็บ same-cutoff candidates ในกลุ่มเดียวและ purge train label windows ที่ทับ cutoff ของ validation/test ไม่ fit preprocessing บน test

เทียบ baseline กับ CatBoost ตรวจ PR/ROC-AUC, precision/recall/F1, Log Loss/Brier/calibration ตามความเหมาะสม แยกแต่ละประเภทและรายงาน class imbalance ไม่อ้าง actual completion calibration หรือ causal uplift Save model/schema/policy/label/environment metadata และทดสอบโหลดกลับ

ขยายประมาณ 80,000 possible samples หลังทบทวน pilot ไม่รับรองความแม่นยำด้วยจำนวนแถว

## 10. Prediction API — งานภายหลัง

ยังไม่สร้าง FastAPI Endpoint ที่วางไว้คือ POST /predict-quests ต้อง validate features/policy version และให้ candidate-specific features ครบ 8 ตัว ไม่มี label/proof/PII

Response คืน model_version, score_type และ purchase_match_probability ต่อ quest_id ค่า 0–1 เพื่อเลือก candidate ไม่ใช้อนุมัติแต้ม ห้ามเรียก completion_probability โดยไม่ได้เปลี่ยน target และประเมินใหม่

## 11. กระบวนการ NestJS — งานภายหลัง

อ่าน paid-order facts และ quest history → features → eligible candidates ตาม shared mechanics → AI ด้วย timeout → validate output → เลือกตาม policy → มอบ UserQuest → log versions/input/candidates/selection

ตรวจสินค้า/ร้านปิดใช้งาน งบแต้ม เควสซ้ำ ความถี่ และสิทธิ์ที่ backend ไม่เลือกคะแนนสูงสุดอย่างเดียว กำหนด fallback ที่ไม่ออก unearned value ตัดสิน cold-start เพราะ relative spend ต้องมี average > 0 และตรวจ domain transfer ก่อนอ้างผลจริง

## 12. Completion และ points

NestJS ตรวจหนึ่ง PAID Order ของเจ้าของใน assignedAt <= paidAt < expiresAt ใช้ final amount หลังส่วนลดและ snapshot category เงินอุดหนุนไม่ใช่ส่วนลด CATEGORY_SPEND ใช้ BR-QUEST-PRICING-01 ไม่ใช้ source-sales oracle เป็น authority

Reward ledger/balance/state atomic และให้ได้ครั้งเดียว ต้องมี concurrency/idempotency tests การให้หลาย assignments จาก Order เดียวและอายุแต้มยังเป็น policy decisions

## 13. Logs และ feedback

Offline manifest เก็บ source/settings/policy hashes, seed, cleaning/censoring/proof NestJS ภายหลังเก็บ model/feature/policy/score-type versions, input summary, candidate scores, selected quest/reason และ validation ตาม FR-S04 ไม่ log credentials/PII

Actual assigned-quest outcomes ภายหลังเป็นข้อมูลใหม่ ไม่สวมชื่อเป็น proxy หรือ online learning อัตโนมัติ

## 14. โครงสร้าง service

Legacy: src/data_contract.py, features.py, quest_rules.py, synthetic_history.py และ prepare_data.py

Current: src/purchase_match.py (pure rules/features/policy), src/complete_journey_source.py (R adapter), prepare_complete_journey.py, config/quest_template_policy_v2.json, config/complete_journey_pilot.json และ tests/test_purchase_match.py

ขั้น 4–7 จึงสร้าง train/evaluate/model artifacts/FastAPI/NestJS adapter ไม่สร้าง placeholder success วันนี้

## 15. Phases และ roadmap

Phase 1 data/features (ขั้น 2–3), Phase 2 train/evaluate (4–5), Phase 3 API (6), Phase 4 integration/completion (7–8), Phase 5 E2E (9) วันนี้จบ Phase 1 ในขอบเขต pilot offline

## 16. ข้อจำกัด

ไม่แก้ schema ไม่เปลี่ยนโมเดล ไม่เพิ่ม generative AI/badges/leaderboards ไม่ถือ external source เป็นประวัติจ่ายเงินของเว็บ ไม่ทำ automatic online learning ไม่แก้ business invariants จากข้อจำกัด dataset

## 17. Deliverables

ขั้น 2–3: current contract/policy, source/preparation code, reviewed pilot/schema/manifest, meaningful tests และคู่มือ ข้อมูล mock เดิมยังอยู่

ขั้น 4–9: trained/evaluated model, prediction API tests, NestJS integration/assignment/logging, actual completion/reward safety และ E2E คู่มือ ทุกผลแยก source proxy / synthetic / real outcomes ให้ชัด
