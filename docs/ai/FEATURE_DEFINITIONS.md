# สูตร Features — Synthetic Quest Recommendation v1 (legacy fixture)

**สูตรปัจจุบันสำหรับ Complete Journey:** [Complete Journey preparation v2](COMPLETE_JOURNEY_PREPARATION.md) กำหนด 8 features, relative thresholds และ proxy labels เอกสารด้านล่างเป็น contract ของ synthetic-v1 เดิม ไม่ลบหรือแก้ผลจำลองย้อนหลัง

สถานะ: สูตรออกแบบในขั้นที่ 2; implement offline ใน [features.py](../../ai-service/src/features.py) และ [quest_rules.py](../../ai-service/src/quest_rules.py) แล้ว มี tests ขั้นที่ 3 ไม่ใช่ production NestJS implementation

อ่านคู่กับ [Dataset schema](DATASET_SCHEMA.md), [แผนหลัก](../../AI_IMPLEMENTATION_PLAN.md) และ [Prisma](../../apps/api/prisma/schema.prisma)

## 1. Cutoff และประวัติที่อนุญาต

ให้ `t = feature_as_of` ซึ่งเป็นเวลาที่ snapshot สำหรับการคิดคะแนน ต้องไม่เกิน assignment time ใน mock ให้ snapshot และ assignment time ตรงกันเพื่อหลีกเลี่ยงความคลาดเคลื่อน หาก scoring จริงเกิดก่อน commit ต้องเก็บ t จริง ห้ามคำนวณย้อนหลังจาก assignedAt โดยเดาว่าเหมือนกัน

`H(d,t)` = Paid Orders ของ user ที่ `t - d*24 ชั่วโมง <= paidAt < t` ตาม UTC, `paidAt` ไม่เป็น null และมี ownership ตรงกัน

7/30 วันเป็น rolling duration ไม่ใช่วันปฏิทินหรือขอบเขตวัน subsidy ของ Bangkok ใช้ timestamp เดียวกันทั้ง offline และ NestJS

นับ distinct Orders ไม่ใช่ OrderItems ไม่ใช่จำนวนชิ้น และไม่รวม PENDING/FAILED/Order ของ user อื่น

## 2. Features พฤติกรรมซื้อ

| Feature                         | สูตร                                                              | Prisma source                           | ไม่มีประวัติ                                       |
| ------------------------------- | ----------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------- |
| `purchases_7d`                  | count ของ H(7,t)                                                  | `Order.userId/status/paidAt/orderId`    | 0                                                  |
| `purchases_30d`                 | count ของ H(30,t)                                                 | เช่นเดียวกัน                            | 0                                                  |
| `total_spend_30d`               | sum `finalAmount` ใน H(30,t)                                      | `Order.finalAmount`                     | decimal 0                                          |
| `avg_order_value_30d`           | total_spend_30d / purchases_30d ด้วย Decimal                      | `Order.finalAmount`                     | null เมื่อ denominator 0                           |
| `target_category_purchases_30d` | จำนวน distinct orders ใน H(30,t) ที่มี item.categoryId ตรง target | `OrderItem.categoryId/orderId` snapshot | 0 ถ้ามี target แต่ไม่เคยซื้อ; null ถ้าไม่มี target |
| `target_merchant_purchases_30d` | count H(30,t) ที่ merchantId ตรง target                           | `Order.merchantId`                      | เช่นเดียวกัน                                       |
| `target_product_purchases_30d`  | จำนวน distinct orders ใน H(30,t) ที่มี item.productId ตรง target  | `OrderItem.productId/orderId`           | เช่นเดียวกัน                                       |

ตัวอย่าง: ซื้อสินค้าเป้าหมาย 3 ชิ้นใน Order เดียว นับ 1 purchase; Order มี 2 items หมวดเดียวกันก็นับหมวดนั้นเพียง 1 ครั้ง

ถ้า `purchases_7d=3` และ `purchases_30d=10` แปลว่าซื้อใน 7 วัน 3 ครั้ง และรวม 30 วัน 10 ครั้ง; 3 ครั้งรวมอยู่ใน 10 แล้ว ไม่บวกเป็น 13

ยอด spend ใช้ finalAmount ก่อนแบ่ง personal/subsidy ไม่ใช้ subtotal หรือ userPaidAmount: final 100, personal 50, subsidy 50 ยังคงเป็น spend 100

Category purchase count ตรวจว่ามี item ในหมวด ไม่ใช่ CATEGORY_SPEND completion; การนับนี้ไม่ต้อง allocate discount แต่ category-spend label ต้องใช้กฎ allocation ที่อนุมัติ

## 3. Features ประวัติเควสต์

`A(t)` = assignments ของ user ที่ assignedAt < t ไม่รวมแถวปัจจุบัน ใช้ทุกช่วงเวลา ไม่จำกัด 30 วัน

`C(t)`/`E(t)` = assignments ใน A(t) ที่ผล COMPLETED/EXPIRED finalized และ outcome_known_at < t; อัตราสำเร็จใช้ C+E เป็น denominator ไม่เอา ACTIVE เข้ามา

| Feature                     | สูตร                                                         | Prisma/raw source                            | ไม่มีข้อมูล            |
| --------------------------- | ------------------------------------------------------------ | -------------------------------------------- | ---------------------- |
| `quests_assigned_before`    | count A(t) รวม assignment ที่ยัง active ก่อน t               | `UserQuest.userId/assignedAt`                | 0                      |
| `quests_completed_before`   | count C(t)                                                   | completion facts + outcome_known_at ของ mock | 0                      |
| `quests_expired_before`     | count E(t)                                                   | finalized expiry facts ของ mock              | 0                      |
| `quest_completion_rate`     | C / (C+E) ด้วย Decimal                                       | counts ข้างบน                                | null ถ้า C+E=0         |
| `same_type_completion_rate` | C_type / (C_type+E_type) เฉพาะ quest_type เดียวกับ candidate | snapshot questType ของอดีต                   | null ถ้า denominator 0 |

ตัวอย่าง: เคยได้รับ 8 เควสต์ สำเร็จ 3 หมดอายุ 2 ยัง active 3 → assigned=8, completed=3, expired=2, completion_rate=0.600000 ไม่ใช่ 3/8

สำเร็จในอนาคตหลัง t ไม่ทำให้ completed_before เพิ่ม การอ่านสถานะปัจจุบันจาก DB อย่างเดียวไม่พอจะรู้ประวัติ ณ t; Prisma มี completedAt แต่ expiry ไม่มี finalized timestamp ต้องตรวจ snapshot/history ก่อนนำไปเทรน ห้ามใช้ expiresAt เป็น outcome_known_at อัตโนมัติ

## 4. Features ของ candidate

ค่ามาจากแม่แบบ/definition snapshot ที่ผ่าน policy ของ NestJS ไม่มาจากข้อความ AI และไม่อ่าน definition ล่าสุดแทนค่าของ assignment เก่า

| Feature                | สูตร/แหล่ง                                                              | Prisma counterpart       |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------ |
| `quest_type`           | type ของ candidate                                                      | `Quest.questType`        |
| `min_spend`            | threshold ก่อนแบ่ง subsidy; null ถ้า product-only ไม่มี spend condition | `Quest.minSpend`         |
| `reward_point`         | แต้มที่เสนอ ไม่ใช่แต้มที่ได้รับจริง                                     | `Quest.rewardPoint`      |
| `duration_days`        | duration ของแม่แบบ; ไม่ derive จากเวลาที่ทำสำเร็จ                       | `Quest.durationDays`     |
| `target_category_id`   | logical category key หรือ null                                          | `Quest.targetCategoryId` |
| `target_merchant_id`   | logical merchant key หรือ null                                          | `Quest.targetMerchantId` |
| `target_product_id`    | logical product key หรือ null                                           | `Quest.targetProductId`  |
| `spend_gap_vs_avg_30d` | min_spend - avg_order_value_30d ด้วย Decimal; signed                    | derived จากค่าข้างบน     |

Gap null เมื่อ average หรือ threshold ไม่มี ค่าลบอนุญาต เช่น threshold 100 แต่ average 120 → -20 ไม่ clamp เป็น 0 เพราะจะทิ้งข้อมูล

สำหรับ CATEGORY_SPEND gap เทียบกับยอดเฉลี่ยทั้ง Order ตามแผนเบื้องต้น ไม่อ้างว่าเป็นยอดเฉลี่ยหมวดหรือหลักฐาน uplift; ยังไม่เพิ่ม category average feature นอกแผน

## 5. Missing values และ encoding

Convention ทางเทคนิค v1: counts/totals ของประวัติว่างเป็น 0; average/rate ที่ไม่เคยมี denominator เป็น null เพื่อแยกไม่เคยทำจากเคยทำแล้วสำเร็จ 0 ครั้ง

ถ้า history มี finalized failures จริง rate=0; ไม่แปลง missing rate เป็น 0 ตั้งแต่ไฟล์ต้นทาง

ใช้ convention Decimal/CSV และ reserved categorical token ตาม DATASET_SCHEMA.md; ordered feature allow-list ต้องตรง training/inference และ versioned หากเปลี่ยนสูตร

## 6. ตัวอย่างคำนวณและ expected checks

ตัวอย่างสมมติสำหรับ expected checks; tests ขั้นที่ 3 อยู่ใน [test_data_preparation.py](../../ai-service/tests/test_data_preparation.py) ส่วน offline/DB parity ยังไม่ได้รันเพราะไม่มี DB adapter:

| กรณี                                                  | ผลที่คาด                                               |
| ----------------------------------------------------- | ------------------------------------------------------ |
| paidAt = t                                            | ไม่รวมในประวัติ                                        |
| paidAt = t-7 วัน                                      | รวมทั้ง 7 และ 30 วัน                                   |
| paidAt ก่อน t-7 แต่ใน 30 วัน                          | รวมเฉพาะ 30 วัน                                        |
| paidAt = t-30 วัน                                     | รวม 30 วัน                                             |
| Order มีสอง items target เดียวกัน                     | target count เพิ่ม 1                                   |
| ไม่มี purchase                                        | counts=0, total=0, average=null, gap=null              |
| ไม่มี target                                          | target count=null; ไม่ใช่ 0 ประวัติจริง                |
| มี target แต่ไม่เคยซื้อ                               | target count=0                                         |
| มี finalized 3 successes, 2 failures และ 3 active     | rate=0.600000                                          |
| outcome รู้หลัง t                                     | ไม่รวมใน completed/expired counts ณ t                  |
| เปลี่ยน Product.categoryId ภายหลัง                    | ประวัติยังใช้ OrderItem.categoryId เดิม                |
| ยอด 100 ลด 10 และใช้ subsidy 45                       | final spend 90; ไม่ใช่ 100 หรือ personal 45            |
| synthetic history เดียวกันเข้า CSV และ development DB | offline/online features เท่ากันหลัง canonical encoding |

Metadata/labels/proof/future purchases ไม่เข้า model feature allow-list IDs ของ user/assignment เป็น grouping ไม่ใช่ predictors

## 7. กฎที่ยืนยันแล้วและสิ่งที่ยังต้องตัดสินใจ

- Allocation และ rounding ยึด `BR-QUEST-PRICING-01` ใน [REQUIREMENTS](../REQUIREMENTS.md): แบ่งส่วนลดจริงตามสัดส่วนรายการที่เข้าเงื่อนไข ใช้ largest remainder ในหน่วยย่อย และรวมยอดหลังลดตาม snapshot category; ไม่หัก subsidy
- Expiry ใช้ `assignedAt <= paidAt < expiresAt` ตาม `NFR-TIME-01`; ไม่ต้องขอ decision ซ้ำ เควสต์ที่ยังไม่สำเร็จหมดอายุเป็น EXPIRED และไม่อยู่ใน active list แต่เก็บประวัติเป็นข้อมูล label 0 เมื่อ outcome finalized แล้ว
- PRODUCT_PURCHASE ที่มี minSpend เพิ่มเติมหรือ targets ผสมยังไม่ใช่กฎที่ตกลง; v1 ออกแบบ product-only แบบตามแผน
- Order เดียวทำหลาย assignments สำเร็จได้หรือไม่ และ reward expiry เป็น policy ของ backend ไม่ใช่ feature design

ประเด็น product rules แบบผสม, Order ทำหลาย assignments สำเร็จ และอายุ reward ยังไม่ตัดสิน ห้าม generator/completion สมมติกฎเหล่านี้เป็น product defaults

## 8. Requirement mapping

- FR-S01: features ของ Paid Orders/Quest History และ cutoff ก่อน assignment
- FR-S02: AI รับข้อมูลและคืน score; ไม่เป็นเจ้าของ completion/reward
- FR-S03: types, bounds และ input feature schema validation
- FR-S04: feature/model/version lineage ที่ต้องบันทึกใน integration
- FR-C07, FR-S06: label มาจาก Paid Order เดียวหลังส่วนลด
- NFR-DATA-02, NFR-TIME-01: exact arithmetic และ UTC

ขั้นที่ 2 เสร็จในขอบเขตเอกสาร ขั้นที่ 3 มี executable offline implementation และ tests ผ่านแล้ว; parity กับ NestJS/DB ยังเป็นงาน integration ภายหลัง
