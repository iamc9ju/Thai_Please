# โครงสร้างข้อมูลฝึก AI — Synthetic Dataset v1

สถานะ: ออกแบบขั้นที่ 2 และ implement offline synthetic preparation ในขั้นที่ 3 แล้ว ดู [คู่มือ](../../ai-service/README.md) และ [manifest](../../ai-service/data/manifest.json) ยังไม่ได้ seed DB หรือ train

อ้างอิง: [แผนหลัก](../../AI_IMPLEMENTATION_PLAN.md), [Roadmap](../AI_BEGINNER_ROADMAP_TH.md), [สูตร features](FEATURE_DEFINITIONS.md), [Prisma](../../apps/api/prisma/schema.prisma)

## 1. ขอบเขตที่ตกลง

- เป็นโปรเจกต์ส่งอาจารย์ ไม่มีข้อมูลจริง ผู้ใช้และประวัติทั้งหมดเป็นข้อมูลจำลอง
- สร้างประวัติต้นทางชุดเดียวภายนอก Database แล้วใช้ทั้งสร้าง CSV สำหรับเทรนและ seed ฐานข้อมูล development เพื่อสาธิต NestJS ในขั้นหลัง
- จำนวนซื้อมีทั้ง `purchases_7d` และ `purchases_30d` แยกคอลัมน์ ไม่บวกกัน
- ยอดซื้อเฉลี่ย/รวม และการซื้อหมวด/ร้านค้า/สินค้าที่กำหนดใช้ 30 วัน
- ประวัติเควสต์ใช้ทั้งหมดก่อนมอบหมาย; อัตราสำเร็จนับเฉพาะผลที่จบแล้วและทราบในขณะนั้น
- เควสต์สำเร็จด้วย Paid Order เดียว หลังส่วนลด ไม่สะสมหลาย Orders และ subsidy ไม่ใช่ส่วนลด

## 2. ข้อมูลต้นทางกับข้อมูลเทรนต่างกันอย่างไร

ข้อมูลต้นทางเก็บเหตุการณ์ เช่น ผู้ใช้ได้รับเควสต์วันไหน ซื้ออะไรเวลาใด ข้อมูลเทรนเป็นตารางสรุปที่คำนวณจากเหตุการณ์เหล่านั้น ไม่สุ่ม features และ labels แยกกันจนขัดกับประวัติ

เส้นทางข้อมูลที่วางแผนไว้:

```text
ประวัติจำลอง + manifest + seed
  ├─ คำนวณ features ณ cutoff → finalized assignments → training_data.csv
  └─ adapter ในขั้นหลัง → development DB → NestJS คำนวณ features สูตรเดียวกัน
```

ขั้นที่ 3 สร้าง raw JSON, feature snapshots, CSV และ manifest แล้ว; ยังไม่มี seed script/API หรือการเปลี่ยน Prisma

## 3. หนึ่งแถวแทนอะไร

หนึ่งแถวแทน user–quest assignment หนึ่งครั้ง ไม่ใช่หนึ่ง Order และไม่ใช่หนึ่ง user

หนึ่ง user มีหลายแถวได้ แต่ `assignment_key` ต้องไม่ซ้ำ ผู้ใช้คนเดิมได้ quest definition เดิมอีกครั้งต้องใช้ assignment key ใหม่

Candidates ที่ไม่ได้รับมอบหมายไม่มี outcome จึงห้ามใส่ label 0 ให้โดยอัตโนมัติ

## 4. ประวัติต้นทางที่ต้องจำลอง

รายการด้านล่างเป็นโครงสร้างไฟล์จำลองที่ต้องมี ไม่ใช่การเพิ่มตารางใน PostgreSQL

| ชุด               | ข้อมูลสำคัญ                                                                                                     | Prisma ที่ใช้ตอนสาธิต                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| users             | synthetic user key, เวลาเริ่มมีประวัติ                                                                          | `User.userId`, `createdAt`                                                  |
| merchants         | synthetic merchant key, สถานะ                                                                                   | `Merchant.merchantId`, `status`                                             |
| categories        | synthetic category key, สถานะ                                                                                   | `ProductCategory.categoryId`, `status`                                      |
| products          | product/merchant/category keys, ราคาทศนิยม                                                                      | `Product`                                                                   |
| orders            | owner/merchant keys, status, paid_at, subtotal, discount_amount, final_amount, subsidy_amount, user_paid_amount | `Order`                                                                     |
| order_items       | order/product/category keys, name snapshot, quantity, unit_price, line_total                                    | `OrderItem`                                                                 |
| quest definitions | type, targets, min_spend, reward_point, duration_days                                                           | `Quest`                                                                     |
| assignments       | key, owner, quest snapshot, assigned_at, expires_at, finalized outcome, completed order key                     | `UserQuest`                                                                 |
| feature snapshots | assignment key, cutoff, ordered features, version                                                               | ส่วน mapping กับ `QuestGenerationLog.inputSummary` ต้องออกแบบใน integration |

ใช้ logical keys ในไฟล์ เช่น `demo-user-001` แล้ว seed adapter map เป็น BigInt IDs ใน DB เก็บ mapping เพื่อให้เปรียบเทียบผลสองทางได้ ค่า ID ที่ส่งเข้า categorical model ต้อง normalize ด้วย mapping เดียวกัน ไม่ใช้เลข DB ที่เปลี่ยนทุกครั้งมาแทน logical identity

แยก identity fixture ที่ระบบ login จำเป็นต้องใช้จากข้อมูลเทรน ห้ามส่งชื่อ เบอร์โทร citizen ID รหัสผ่าน QR token หรือ wallet credentials ให้โมเดล

การ seed Paid Orders/แต้มในอนาคตต้องรักษา wallet/point ledgers และ snapshots ไม่ใส่ balance หรือ reward ลอย ๆ เพื่อให้ demo ผ่าน และไม่ใช้ seed เดิมเป็น training generator โดยไม่ตรวจ invariants

## 5. Metadata และ label — ไม่ใช่ features

| คอลัมน์                  | Type         | ว่างได้ | ความหมาย/แหล่งข้อมูล                                                      |
| ------------------------ | ------------ | ------- | ------------------------------------------------------------------------- |
| `assignment_key`         | string       | ไม่     | logical key ของ assignment; map `UserQuest.userQuestId`                   |
| `user_key`               | string       | ไม่     | grouping/audit เท่านั้น; map `UserQuest.userId`                           |
| `quest_key`              | string       | ไม่     | definition identity; map `UserQuest.questId`                              |
| `assigned_at`            | UTC ISO-8601 | ไม่     | `UserQuest.assignedAt`                                                    |
| `feature_as_of`          | UTC ISO-8601 | ไม่     | เวลา snapshot ที่ใช้คิดคะแนน ต้องไม่เกิน assigned_at                      |
| `expires_at`             | UTC ISO-8601 | ไม่     | `UserQuest.expiresAt`                                                     |
| `outcome_known_at`       | UTC ISO-8601 | ไม่     | เวลาที่ทราบ finalized outcome; ยังไม่มีฟิลด์ตรงตัวสำหรับ expiry ใน Prisma |
| `completed_order_key`    | string       | ได้     | proof ของ label 1; map `completedOrderId`; label 0 เป็นว่าง               |
| `completed`              | integer 0/1  | ไม่     | คำตอบของโมเดล ไม่ส่งใน prediction request                                 |
| `data_origin`            | `SYNTHETIC`  | ไม่     | ทั้งชุดเป็นข้อมูลจำลอง                                                    |
| `dataset_version`        | string       | ไม่     | รุ่นของข้อมูลและ generator manifest                                       |
| `feature_schema_version` | string       | ไม่     | รุ่นสูตร/ลำดับ features/encoding                                          |
| `rule_version`           | string       | ไม่     | กฎที่ใช้สร้าง outcome                                                     |
| `currency`               | string       | ไม่     | currency เดียวตาม manifest ที่ตรวจแล้ว ไม่อ่านจากสมมติฐานใน source        |

ไม่ใส่ metadata หรือผลอนาคตใน feature allow-list เช่น completed_at, completed order, actual reward, selected prediction score

## 6. Feature columns

ลำดับในตารางนี้คือ feature order v1 สูตรละเอียดอยู่ใน FEATURE_DEFINITIONS.md

| คอลัมน์                         | Type ก่อน preprocessing | ว่างได้                                       |
| ------------------------------- | ----------------------- | --------------------------------------------- |
| `purchases_7d`                  | integer >= 0            | ไม่                                           |
| `purchases_30d`                 | integer >= 0            | ไม่                                           |
| `avg_order_value_30d`           | decimal string >= 0     | ได้เมื่อไม่มีซื้อ                             |
| `total_spend_30d`               | decimal string >= 0     | ไม่                                           |
| `target_category_purchases_30d` | integer >= 0            | ได้เมื่อไม่มี target                          |
| `target_merchant_purchases_30d` | integer >= 0            | ได้เมื่อไม่มี target                          |
| `target_product_purchases_30d`  | integer >= 0            | ได้เมื่อไม่มี target                          |
| `quests_assigned_before`        | integer >= 0            | ไม่                                           |
| `quests_completed_before`       | integer >= 0            | ไม่                                           |
| `quests_expired_before`         | integer >= 0            | ไม่                                           |
| `quest_completion_rate`         | decimal string 0–1      | ได้เมื่อไม่มี finalized history               |
| `same_type_completion_rate`     | decimal string 0–1      | ได้เมื่อไม่มี finalized history ของ type นั้น |
| `quest_type`                    | categorical string      | ไม่                                           |
| `min_spend`                     | decimal string >= 0     | ได้สำหรับ product-only quest                  |
| `reward_point`                  | integer >= 0            | ไม่                                           |
| `duration_days`                 | integer > 0             | ไม่                                           |
| `target_category_id`            | categorical logical key | ได้                                           |
| `target_merchant_id`            | categorical logical key | ได้                                           |
| `target_product_id`             | categorical logical key | ได้                                           |
| `spend_gap_vs_avg_30d`          | signed decimal string   | ได้เมื่อ threshold/average ไม่มี              |

Type allow-list: `MIN_SPEND`, `CATEGORY_SPEND`, `PRODUCT_PURCHASE`, `MERCHANT_SPEND` ตามแผนหลัก

Required targets: category สำหรับ CATEGORY_SPEND, product สำหรับ PRODUCT_PURCHASE, merchant สำหรับ MERCHANT_SPEND; spend types ต้องมี min_spend หากพบกฎแบบผสมที่ยังไม่ได้ตกลงให้ reject/quarantine ไม่ตีความเอง

ค่าคอลัมน์เงินมีหน่วย currency หลักเดียวกันใน manifest เช่นตัวอย่าง THB ไม่ผสมบาท/สตางค์ เงินต้นทางเก็บตาม scale ที่ validated; ค่าเฉลี่ย/อัตรา derived ใช้ Decimal ปัด HALF_EVEN ที่ 6 ตำแหน่ง เป็น convention ทางเทคนิคของ feature v1 ไม่ใช่ rounding policy ของ payment

CSV: UTF-8, header ตรงชื่อและลำดับที่กำหนด metadata ก่อน features; ค่าว่างแทน null ไม่ใช้ข้อความ `None`/`null` และ loader ต้องมี dtype/schema ชัดเจนไม่เดาจาก CSV

Numeric null แปลงเป็น missing numeric ที่ CatBoost รองรับในขั้น preprocessing; categorical null แปลงเป็น reserved token `__NO_TARGET__` ที่ logical keys ห้ามใช้; category/product/merchant ที่ไม่เคยพบยังคงเป็น categorical key ใหม่ ไม่แทนด้วย user identity

การแปลง features เป็น numerical model inputs เป็นขั้น ML preprocessing ที่ versioned ไม่ใช้ค่าแปลงเหล่านี้ตัดเงินหรือตรวจเควสต์; การเงินและ labels ยังคำนวณแบบ exact

## 7. Label และเวลา

- `completed=1`: finalized completion ที่มี Paid Order proof ของ owner ภายใน validity ตามกฎที่อนุมัติ ผ่าน threshold หลังส่วนลด/target และให้แต้มได้ครั้งเดียว
- `completed=0`: finalized expired โดยไม่มี qualifying receipt; ต้องตรวจ receipt-time ไม่ใช่แค่เวลาที่ worker ทำงาน
- ACTIVE/PENDING, unknown state, canceled/rejected, inconsistent proof หรือผลที่ยังไม่ finalized: ไม่เข้า supervised CSV
- ทุก outcome ใน dataset ต้องทราบแล้ว ณ `dataset_as_of` ของ manifest
- Feature cutoff ห้ามอ่าน orders หรือ outcomes ตั้งแต่ feature_as_of เป็นต้นไป
- ประวัติจำลองต้องเก็บ outcome_known_at แยกจาก receipt paid_at เพื่อไม่ใช้ผลที่ประมวลผลทีหลังย้อนเป็นข้อมูลที่รู้ก่อนหน้า

Boundary ยึด `NFR-TIME-01`: `assigned_at <= paid_at < expires_at` จ่ายตรงเวลาหมดอายุไม่ทัน; Assignment ที่ยังไม่สำเร็จเปลี่ยนเป็น EXPIRED และซ่อนจาก active list แต่คงประวัติไว้ ทำ label 0 เฉพาะผล finalized ไม่เปลี่ยน COMPLETED เป็น EXPIRED

## 8. ตัวอย่างหนึ่งแถว (เฉพาะคอลัมน์หลัก)

ตัวอย่างสมมติในเอกสาร ไม่ใช่ไฟล์ dataset ที่สร้างแล้ว และไม่ใช่ default policy:

| user_key      | purchases_7d | purchases_30d | total_spend_30d | avg_order_value_30d | quest_type | min_spend | reward_point | duration_days | completed |
| ------------- | -----------: | ------------: | --------------- | ------------------- | ---------- | --------- | -----------: | ------------: | --------: |
| demo-user-001 |            3 |            12 | 1020.00         | 85.000000           | MIN_SPEND  | 100.00    |           50 |             7 |         1 |

currency ตัวอย่างเป็น THB; มี Paid Order proof ยอด final 110.00 ใน validity หลัง feature cutoff การซื้อเพื่อสำเร็จไม่รวมใน 12 ครั้งก่อน cutoff และ proof เก็บใน metadata แยกจาก features

## 9. ข้อจำกัด Prisma และ integration

- `Order.finalAmount`/`paidAt`, item snapshots และ quest targets มีอยู่แล้ว ไม่ต้องเพิ่มเพื่อเขียนเอกสารนี้
- Currency, feature cutoff, immutable quest rule snapshot และ outcome_known_at ยังไม่มี dedicated fields ครบ; mock manifest เก็บได้ แต่การ persist ใน DB ต้องออกแบบและอนุมัติหากต้อง migrate
- `QuestGenerationLog.inputSummary` เป็น JSON ยังไม่มี schema/version และ log ไม่มี assignment FK; ห้าม join ด้วย user+quest แล้วเลือก latest log เพราะอาจได้ข้อมูลอนาคต/assignment คนละครั้ง
- Timestamp ของ Order/Quest ส่วนใหญ่ยังเป็น without time zone; seed ต้องมี explicit UTC conversion และทดสอบ ห้ามเชื่อ host timezone
- Current `Quest` หรือ `Product` ที่แก้ภายหลังไม่ใช่ snapshot ของอดีต
- CATEGORY_SPEND ใช้กฎ `BR-QUEST-PRICING-01` ใน REQUIREMENTS: แบ่งส่วนลดจริงตามสัดส่วนรายการที่เข้าเงื่อนไข ปัดด้วย largest remainder และรวมยอดหลังลดตามหมวด ไม่หัก subsidy; Prisma ยังไม่มี allocated line discounts ต้องเก็บใน mock snapshots และเสนอ persistence ใน integration ก่อนแก้ schema

## 10. เกณฑ์ตรวจในขั้นสร้างข้อมูล

ขั้นที่ 3 ผ่าน offline tests 25 รายการและ revalidation/hash checks แล้ว ดู [tests](../../ai-service/tests/test_data_preparation.py) ส่วน offline/DB parity และการแบ่ง train/test เป็นงาน integration/training ที่ยังไม่ได้ทำ ไม่ถือว่าผ่านจาก offline tests

| ตรวจ                                   | Expected result                                                           | Requirement         |
| -------------------------------------- | ------------------------------------------------------------------------- | ------------------- |
| unique assignment/foreign logical keys | ไม่ซ้ำ ไม่ dangling                                                       | NFR-DATA-01         |
| feature schema/order/dtypes            | columns ครบ null ตามสัญญา                                                 | FR-S01, FR-S03      |
| time cutoff                            | ไม่มีข้อมูลอนาคต; ใส่ future order แล้ว features เดิมไม่เปลี่ยน           | FR-S01              |
| labels                                 | ACTIVE ไม่เป็น 0; paid owner/order เดียว                                  | FR-C07, FR-S06      |
| spend                                  | หลังส่วนลด; subsidy ไม่ลด spend                                           | FR-S06, NFR-DATA-02 |
| provenance                             | SYNTHETIC, seed, versions และ cutoff ครบ                                  | FR-S04, NFR-OBS-01  |
| offline/DB feature parity              | raw history เดียวกันได้ features เหมือนกัน                                | FR-S01, NFR-TIME-01 |
| split                                  | chronological; train labels รู้ก่อน training cutoff; test ไม่ใช้ปรับโมเดล | แผน AI หัวข้อ 9     |

## 11. งานถัดไปและ decision gates

ขั้นที่ 3 สร้าง mock generator/raw data และ CSV โดยใช้ expiry/category discount policy ที่ยืนยันแล้วใน REQUIREMENTS จำนวน users/orders/ช่วงวัน/seed และสัดส่วน scenario เป็น synthetic generator configuration ที่ต้องระบุ ไม่ใช่ product policy และยังไม่ได้กำหนดตัวเลขในเอกสารนี้

Selection policy, active limits, reward budget, trigger และ fallback รอขั้น integration; ไม่ต้องแอบตัดสินเพื่อทำ feature design

ผลประเมินที่ได้จะเป็น synthetic performance เท่านั้น ไม่ใช่หลักฐานความแม่นยำจริงหรือเพิ่มยอดใช้จ่ายจริง
