# ขั้น 2–3: Complete Journey และการให้คะแนนเควสเทมเพลต

วันที่ปรับแนวทาง: 15 ตุลาคม 2026 — ผู้ใช้อนุมัติเป้าเป็นสัดส่วนยอดเฉลี่ย ชุดทดลองก่อน และหมวดกว้าง department วันนี้หยุดก่อนขั้น 4

## 1. โครงสร้างที่คงเดิม

CatBoost ให้คะแนน candidate จากเทมเพลต 4 ประเภท → NestJS เลือก/ตรวจ policy/มอบเควส → deterministic engine ตรวจหนึ่ง Paid Order และให้แต้มครั้งเดียว การคำนวณหลังส่วนลดและไม่หักเงินอุดหนุนตาม FR-C07/FR-S06 คงเดิม ไม่มีการแก้ Database Schema

โมเดลใหม่จะทำนาย `purchase_match_probability` คือการซื้อที่ตรงเงื่อนไขตามพฤติกรรมที่สังเกตได้ ไม่ใช่ผลตอบสนองต่อเควสจริง เพราะ dataset ไม่มี quest exposure, completion หรือ reward response

ชุด synthetic-v1 เดิม 496 แถวและ 20 features ยังคงอยู่แยกต่างหากสำหรับทดสอบกฎ ไม่ merge กับชุดใหม่ และไม่เปลี่ยนข้อเท็จจริงของ mock เดิมย้อนหลัง

## 2. หนึ่ง sample คืออะไร

หนึ่งแถว = **หนึ่งครัวเรือน + UTC cutoff หนึ่งเวลา + candidate หนึ่งข้อ** ไม่ใช่หนึ่งคนอย่างเดียว และไม่ใช่หนึ่งแถวสินค้า

- Features พฤติกรรมมาจาก baskets ก่อน cutoff เท่านั้น
- รายละเอียด candidate มาจาก policy ก่อนดูการซื้อในอนาคต
- Label มาจากการซื้อใน `[cutoff, cutoff + duration)`
- IDs/ยอดต้นทาง/proof เป็น metadata ไม่เข้าตัวทำนาย

## 3. Features v2 — 8 ตัว

| ลำดับ | Feature                         | สูตรและที่มา                                          | เมื่อไม่เกี่ยวข้อง              |
| ----- | ------------------------------- | ----------------------------------------------------- | ------------------------------- |
| 1     | `purchases_7d`                  | distinct accepted baskets ของเจ้าของใน `[t-7 วัน,t)`  | 0 เมื่อไม่มีซื้อ                |
| 2     | `purchases_30d`                 | distinct accepted baskets ของเจ้าของใน `[t-30 วัน,t)` | 0 เมื่อไม่มีซื้อ                |
| 3     | `target_category_purchases_30d` | จำนวน baskets ที่มี item หมวดเป้าหมาย ไม่ใช่จำนวนชิ้น | null เมื่อไม่มี category target |
| 4     | `target_merchant_purchases_30d` | จำนวน baskets ของ store เป้าหมาย                      | null เมื่อไม่มี store target    |
| 5     | `target_product_purchases_30d`  | จำนวน baskets ที่มี product เป้าหมาย                  | null เมื่อไม่มี product target  |
| 6     | `quest_type`                    | enum 4 ประเภทจาก candidate                            | ห้ามว่าง                        |
| 7     | `min_spend_ratio`               | actual threshold / prior 30-day whole-basket average  | null สำหรับ product-only        |
| 8     | `duration_days`                 | ระยะเวลาจาก candidate policy                          | ห้ามว่าง                        |

Counts เป็น integer ไม่ติดลบ, type เป็น categorical string, ratio เป็น Decimal string 6 ตำแหน่ง HALF_EVEN, duration เป็น positive integer ลำดับคอลัมน์ต้องตรงทั้ง offline และ inference ค่าที่ไม่เกี่ยวข้องไม่เปลี่ยนเป็น 0 เพราะ 0 แปลว่ามี target แต่ไม่เคยซื้อ

Source timestamps อ่านด้วย explicit UTC; source ปรับปี/วินาทีแล้วตาม [audit](COMPLETE_JOURNEY_DATASET_AUDIT.md) ห้ามใช้เวลาเครื่อง

### สิ่งที่ปรับจาก 20 ตัวเดิม

- ตัด quest-history features 5 ตัว เพราะไม่มีข้อมูลจริง ไม่สร้างประวัติสำเร็จเควสย้อนหลังขึ้นมาแทน
- ไม่ใช้ reward ทำนาย เพราะ source ไม่สังเกตผลของรางวัล เก็บ reward ภายหลังเป็น policy ของ backend
- ไม่ส่ง avg/total/min_spend/gap แบบจำนวนเงินจริงเป็น predictors: source dollars กับเว็บบาทต่างหน่วย ใช้ ratio ของ actual threshold ต่อ average แทน raw min_spend; average/total ยังใช้คำนวณและอยู่ metadata
- ไม่ส่ง target IDs เป็น predictors เพราะ ID ต้นทางใช้กับเว็บไม่ได้ แต่ยังเก็บ identities เพื่อคำนวณ counts และพิสูจน์ label

นี่เป็น baseline feature contract สำหรับทดลอง ไม่อ้างว่า 8 ตัวดีที่สุดหรือว่าข้อมูลสหรัฐถ่ายโอนไปเว็บไทยแล้วแม่นทันที เพิ่ม/เปลี่ยน features ภายหลังต้อง version และประเมินในบริบทเว็บจริง

## 4. นโยบายเทมเพลตร่วม

[quest_template_policy_v2.json](../../ai-service/config/quest_template_policy_v2.json) มี schema/version และเป็น JSON ที่ NestJS อ่าน/validate ได้ภายหลัง โปรแกรมเตรียมข้อมูลใช้นโยบายนี้แล้ว แต่วันนี้ไม่ได้ implement NestJS adapter

- `spend_multipliers`: 1.0 และ 1.5 เท่าของ **ยอดเฉลี่ยทั้งบิลย้อนหลัง 30 วัน** ไม่ใช่ยอดเฉลี่ยเฉพาะหมวด
- `duration_days`: 7 วัน สำหรับชุดทดลอง
- `MIN_SPEND`: threshold เทียบยอดทั้งบิล
- `CATEGORY_SPEND`: threshold เทียบยอด items ของหมวดในบิลเดียว
- `MERCHANT_SPEND`: store เป้าหมายและยอดทั้งบิลถึง threshold
- `PRODUCT_PURCHASE`: มี product เป้าหมาย ไม่มี minimum spend เพิ่ม

คำนวณ `threshold_minor = ceil(total_minor_30d × multiplier / purchases_30d)` ด้วย Decimal/integer และใช้ actual rounded threshold คำนวณ feature ratio อีกครั้ง ตัวอย่าง total 100.01 / 2 = average 50.005, multiplier 1.5 → threshold 75.01 หลังปัดขึ้นในหน่วยย่อย ไม่ใช้ binary float คำนวณเงิน

Policy เป็น `OFFLINE_EXPERIMENT` ไม่ใช่ policy ออกแต้มที่อนุมัติใช้จริง ค่า reward, eligibility, budget, trigger, active limits และ cold-start ต้องตกลงใน integration ตัวเลือกจริงต้องมีสินค้า/หมวด/ร้านที่ใช้งานได้ ไม่จำเป็นต้องเสนอทุกตัวเลือกให้ทุกคน

Target ของชุดทดลองเลือกด้วย seed จากข้อมูลก่อน cutoff: 50% จากประวัติครัวเรือน อีก 50% จาก catalog ที่เคยถูกซื้อก่อน cutoff ไม่เลือกจากอนาคตเพื่อทำให้ label เป็น 1 ครัวเรือนสุ่มจากคนที่มีประวัติก่อน cutoff แรก ไม่เลือกจากผลซื้ออนาคต

## 5. ระดับหมวดและจำนวนเงินต้นทาง

ผู้ใช้เลือกหมวดกว้าง `department` (32 กลุ่มใน metadata) ก่อน แทน `product_category` 303 กลุ่ม เพราะรอบแรกหมวดย่อยไม่มี CATEGORY_SPEND label 1 เมื่อเป้าเทียบกับ average ทั้งบิล ทั้งหมวดที่ถูกตัดและกลุ่มที่ไม่ถูกซื้อในช่วงทดลองจึงไม่จำเป็นต้องปรากฏครบ 32 กลุ่มใน CSV

ชุดนี้ใช้ `SOURCE_SALES_VALUE`, currency USD, scale 2 ยอดเป็น retailer revenue ตาม dictionary ไม่ใช่หลักฐานยอดชำระสุทธิหลังส่วนลดทุกประเภทของระบบเรา ห้ามคูณ quantity ซ้ำ หักส่วนลดซ้ำ หรือเปลี่ยนเป็นบาทโดยแค่เปลี่ยนชื่อสกุลเงิน

Ratio ช่วยเรื่องหน่วย แต่ไม่แก้ความต่างของเศรษฐกิจหรือพฤติกรรมของสองระบบ การใช้จริงยังต้องตรวจ domain/amount semantics Source product metadata เป็นตารางคงที่ ไม่มีหลักฐาน category snapshot ครบทุกช่วง; ไม่อ้างว่าเป็นประวัติ immutable แบบเว็บเรา

## 6. Cleaning และความครบของช่วงสังเกต

ตรวจ source hashes ตรง revision ก่อนอ่าน ตรวจ owner/store/time ของ basket สม่ำเสมอและ product join เป็น many-to-one

ยกเว้น **ทั้ง basket** หากมี quantity <= 0/fractional/missing, amount ติดลบ, selected category หาย, source department FUEL/COUPON/MISCELLANEOUS หรือ total <= 0 ไม่ตัด item แล้วอ้างว่ายอดที่เหลือคือยอดเดิม Item ฟรีที่ quantity > 0 อยู่ใน basket total > 0 ยังเก็บได้

- Rejected basket ในประวัติ 30 วัน → ยกเว้น household/cutoff นั้น เพื่อไม่คำนวณ features จากประวัติที่ถูกตัดบางส่วน
- Rejected basket ใน label window → ไม่มี label และยกเว้น candidate แม้มีอีกบิลตรงเงื่อนไข เป็น conservative selection ที่ต้องรายงาน bias
- ช่วงสังเกตไม่ครบ หรือชน known gap Christmas ที่ผู้เผยแพร่ลบ → ไม่ให้ label 0

ช่วงสังเกตตาม source คือ `[2017-01-01T05:00Z,2018-01-01T05:00Z)` ไม่ใช้ last purchase ของแต่ละคนเป็นวันสิ้นสุด สิ่งนี้เป็นขอบเขตการเก็บข้อมูลของ source ไม่ได้พิสูจน์ว่าเห็นการซื้อทุกช่องทางของครัวเรือน

## 7. Label และ metadata

`label = 1` เมื่อมีหนึ่ง basket ของเจ้าของใน validity ที่ผ่าน predicate; `0` เมื่อไม่พบและทั้งหน้าต่างครบ ไม่รวมหลายบิล และไม่ถือว่า candidate ถูกมอบจริง

Metadata ได้แก่ sample hash, household/source target keys, cutoff/expiry, configured multiplier, actual threshold minor units, history total/count, currency/basis, policy version และ matching basket proof Label/proof/อนาคต/metadata ไม่รวมใน 8 features

Proof เลือกบิลแรกที่ตรง โดย sort timestamp แล้ว basket key ผล label 0 ไม่มี proof ความพร้อมข้อมูลเป็นอีกสถานะหนึ่ง ไม่ใช่ failure

## 8. โปรแกรมและผลลัพธ์ขั้น 3

[prepare_complete_journey.py](../../ai-service/prepare_complete_journey.py) อ่าน R files ตรวจ/normalize ทั้ง source แล้วเลือกครัวเรือน 200 ราย จุดเริ่มต้น 4 วัน (1 มี.ค., 1 เม.ย., 1 พ.ค., 1 มิ.ย. 2017 UTC) และ 4 candidates ต่อจุดเริ่มต้น เป็น **สูงสุด 3,200 ก่อนกรอง** ไม่ backfill โดยดูผลอนาคตเพื่อให้ครบจำนวน

ผลอยู่ใน `ai-service/data/complete_journey_pilot/`:

- `training_data.csv`: metadata + 8 features + label; null เป็นช่องว่าง ยังไม่ได้ split หรือ train
- `feature_schema.json`: ordered features/metadata/label/score versions
- `template_policy.json`: exact policy bytes พร้อม hash
- `sample_preview.json`: ตัวอย่าง 8 samples แยก metadata กับ features
- `excluded_samples.csv`: เหตุผลยกเว้น; type `ALL` หมายถึงทั้ง 4 candidates ของ household/cutoff
- `manifest.json`: source/config/policy hashes, cleaning counts, seed, households, classes/types และข้อจำกัด

สร้างซ้ำต้องได้ bytes/hash เดิม ปฏิเสธ output ต่างกันหากไม่มี `--overwrite` Raw source/reader อยู่ external ที่ ignore ไม่เพิ่มทั้งล้านแถวเข้า Git หรือ DB แต่ตรวจ source ครบก่อนเลือก pilot

## 9. งานภายหลังและ traceability

ผลชุดทดลองที่ตรวจแล้ว: 1,664 samples จาก 159 ครัวเรือนที่เหลือหลังกรอง (เริ่มสุ่ม 200) label 1 = 163 / 0 = 1,501 แต่ละประเภทมี 416 samples; positives ของ MIN_SPEND 105, CATEGORY_SPEND 13, MERCHANT_SPEND 41 และ PRODUCT_PURCHASE 4 การซื้อสินค้าเฉพาะมี positives น้อย จึงยังไม่ควรรับรองคุณภาพโมเดลหรือจำนวน samples ว่าพอ ก่อนขั้น 4 ต้องทบทวน coverage และวิธีประเมิน

Offline tests ผ่าน 50 รายการ รวม legacy 25; ตรวจ proofs ทั้ง 163 กลับไป original source และตรวจ hashes/จำนวน exclusions แล้ว ไม่ใช่ผลทดสอบ production NestJS หรือ Database

วันนี้ทำ schema/policy/features/source/labels/pilot/tests/docs เท่านั้น ไม่มี model artifact, model metrics, FastAPI, NestJS adapter, migration, seed หรือรางวัล

ขั้น 4 ภายหลังใช้ CatBoost กับ 8 features และ proxy label เทียบ baseline แบ่งตามเวลาและเก็บ candidates ของ cutoff เดียวกันในกลุ่มเดียว ฝั่ง train ต้องมี expiry ไม่เกิน cutoff ของ validation/test เพื่อ purge label overlap ไม่ random split rows ที่ใช้ประวัติร่วมกัน แล้วจึงพิจารณาชุดหลักประมาณ 80,000 ก่อนกรอง จำนวน sample ไม่รับรองความแม่นยำ

NestJS ใช้ paid-order facts หลังส่วนลดสร้าง features/threshold ตาม schema/policy ratio/rounding เดียวกัน ส่วน actual completion/reward ไม่ใช้ source-sales oracle เป็น authority

- FR-S01: อดีตเท่านั้น; real quest history ยังใช้ eligibility/dedup แม้ไม่เป็น model features
- FR-S02/FR-S03: ไม่มี AI/DB writes; strict policy/type/threshold validation และ feature allow-list
- FR-S04: provenance/version/seed/proof ไม่ใช่ generation logs ใน DB
- FR-C07/FR-S06: แม่แบบ 4 แบบและหนึ่งบิล; proxy ไม่อ้าง actual completion
- NFR-DATA-02/NFR-TIME-01: exact amounts, UTC, exclusive expiry, censored rows ไม่เป็น 0
