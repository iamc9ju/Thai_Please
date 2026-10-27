# ThaiChuayThaiPlease — Product Requirements

## 1. Document Control

| รายการ              | ค่า                                  |
| ------------------- | ------------------------------------ |
| ชื่อระบบ            | ThaiChuayThaiPlease — ไทยช่วยไทยพลีส |
| ประเภท              | Functional Prototype                 |
| สถานะ               | Draft for Review                     |
| วันที่ปรับปรุง      | 13 ตุลาคม 2026                       |
| Repository เป้าหมาย | `D:\work\Thai_Please`                |
| Database            | PostgreSQL บน Neon                   |
| Business timezone   | `Asia/Bangkok`                       |
| สกุลเงิน            | THB                                  |
| หน่วยเงิน Prototype | Integer Baht                         |
| Frontend            | React, TypeScript และ Vite           |
| Backend             | NestJS, TypeScript และ Prisma        |
| API                 | Versioned REST API ภายใต้ `/api/v1`  |

เอกสารนี้เป็นข้อกำหนดหลักสำหรับพัฒนา Prototype โดยต้องใช้ Schema, Migration, Source Code และเอกสารเดิมใน Repository เป็นฐาน ห้ามสร้าง Schema ใหม่โดยไม่ตรวจสอบโครงสร้างเดิมและจัดทำ Migration Plan ก่อน

---

## 2. Product Vision

ThaiChuayThaiPlease เป็นแพลตฟอร์มดิจิทัลสำหรับ:

- ลดภาระค่าครองชีพของประชาชนผ่านระบบร่วมจ่าย
- เพิ่มรายได้ให้ร้านค้ารายย่อยและร้านค้าชุมชน
- กระตุ้นการกลับมาใช้จ่ายซ้ำด้วย Quest, Point และ Coupon
- แสดงผลลัพธ์ทางเศรษฐกิจและสังคมแก่ผู้ดูแลโครงการ

วงจรหลักของระบบ:

```text
ร้านค้าสร้าง Order ผ่าน POS
→ Customer ตรวจสอบและชำระเงิน
→ ระบบช่วยจ่ายตามสิทธิ์
→ ระบบเครดิตรายรับเข้า Merchant Wallet
→ ระบบตรวจ Quest
→ Customer ได้รับ Point
→ Customer แลก Point เป็น Coupon
→ Customer นำ Coupon กลับมาใช้จ่ายอีกครั้ง
```

ระบบใช้ Virtual Money เท่านั้น ไม่มีการเชื่อมต่อธนาคาร Payment Gateway หรือระบบชำระเงินจริง

---

## 3. Identity, Account, Role และ Portal

### 3.1 Person Identity และ Multiple Roles

- เลขประจำตัวประชาชนหนึ่งหมายเลขมี Identity ใน `users` ได้หนึ่งรายการ
- บุคคลหนึ่งคนสามารถมีบทบาท `CONSUMER`, `MERCHANT` และ `ADMIN` พร้อมกันได้
- Role ต้องเก็บแบบหลายรายการผ่าน `user_roles` ไม่ใช้คอลัมน์ `users.role` แบบค่าเดียว
- การมี Role หนึ่งไม่ทำให้ได้สิทธิ์ของอีก Role โดยอัตโนมัติ
- ทุก Session ต้องมี `active_role` เพื่อกำหนดขอบเขตสิทธิ์ในขณะใช้งาน
- Merchant Session ต้องมี Merchant Context ที่ผู้ใช้มีสิทธิ์เข้าถึง
- Frontend ต้องแยกทางเข้า Customer, Merchant และ Admin อย่างชัดเจน

ตัวอย่างบุคคลเดียวกัน:

```text
Citizen ID: 1101700203451

Roles:
- CONSUMER
- MERCHANT
- ADMIN

สามารถเข้าได้ทั้ง:
- Customer Portal
- Merchant Portal
- Admin Portal
```

### 3.2 Portal Separation

ระบบมีหน้า Login แยกตาม Portal:

```text
/customer/login
/merchant/login
/admin/login
```

Backend ต้องตรวจว่าผู้ใช้มี Role ที่ตรงกับ Portal ก่อนสร้าง Session

ผู้มีหลาย Role ใช้ Citizen ID และ Password เดียวกันได้ แต่ Session ที่สร้างขึ้นต้องจำกัดสิทธิ์ตาม Portal ที่เลือก

ตัวอย่าง:

- Login ผ่าน Customer Portal → `active_role = CONSUMER`
- Login ผ่าน Merchant Portal → `active_role = MERCHANT`
- Login ผ่าน Admin Portal → `active_role = ADMIN`

การเปลี่ยน Portal ต้องสร้างหรือเปลี่ยน Session Context โดยให้ Backend ตรวจ Role ใหม่ ห้ามเปลี่ยน Role จากค่าที่ Frontend ส่งมาโดยไม่มีการตรวจสอบ

### 3.3 Account Status

สถานะ User:

```text
ACTIVE
SUSPENDED
DISABLED
```

สถานะ User Role:

```text
ACTIVE
SUSPENDED
REVOKED
```

สถานะ Merchant:

```text
PENDING
ACTIVE
REJECTED
SUSPENDED
```

---

## 4. Authentication and Registration

### FR-AUTH-01 — Customer Registration

Customer สมัครสมาชิกด้วยข้อมูลพื้นฐานตามรูปแบบบริการของหน่วยงานรัฐ:

- เลขประจำตัวประชาชน 13 หลัก
- คำนำหน้าชื่อ
- ชื่อ
- นามสกุล
- วันเดือนปีเกิด
- เบอร์โทรศัพท์
- ที่อยู่ตามทะเบียนบ้าน
- รหัสผ่าน
- ยืนยันรหัสผ่าน
- การยอมรับข้อกำหนดการใช้งาน
- การรับทราบนโยบายความเป็นส่วนตัว

ข้อมูลที่อยู่ประกอบด้วย:

- บ้านเลขที่
- หมู่
- อาคาร ชั้น และห้อง ถ้ามี
- ตรอกหรือซอย
- ถนน
- แขวงหรือตำบล
- เขตหรืออำเภอ
- จังหวัด
- รหัสไปรษณีย์

กฎการลงทะเบียน:

- Citizen ID ต้องเป็นตัวเลข 13 หลักและผ่าน Check Digit
- วันเกิดต้องเป็นวันที่ถูกต้องและไม่ใช่วันในอนาคต
- เบอร์โทรศัพท์ต้องอยู่ในรูปแบบที่รองรับ
- รหัสผ่านและยืนยันรหัสผ่านต้องตรงกัน
- ต้องยอมรับข้อกำหนดและนโยบายความเป็นส่วนตัว
- หาก Citizen ID ยังไม่มีในระบบ ให้สร้าง `users` และเพิ่ม Role `CONSUMER`
- หาก Citizen ID มีอยู่แล้วและยืนยัน Password สำเร็จ ให้เพิ่ม Role `CONSUMER` โดยไม่สร้าง User ซ้ำ
- หากมี Role `CONSUMER` อยู่แล้ว ต้องไม่สร้าง Role หรือ Wallet ซ้ำ

การลงทะเบียน Customer ต้องทำใน Database Transaction เดียว:

1. สร้างหรือยืนยัน User Identity
2. เพิ่ม `user_roles` เป็น `CONSUMER`
3. สร้าง Consumer Wallet หากยังไม่มี
4. ตรวจ Subsidy Program ที่ Active
5. มอบ Initial Subsidy หากเข้าเงื่อนไข
6. สร้าง `wallet_transactions` ประเภท `SUBSIDY_GRANT`
7. บันทึกเวลายอมรับข้อกำหนดและนโยบาย
8. บันทึก Audit Event

หากขั้นตอนใดล้มเหลว ต้อง Rollback ทั้งหมด

### FR-AUTH-02 — Merchant Registration

Merchant Registration ใช้ Identity ของเจ้าของหรือผู้ดูแลร้าน โดยบุคคลเดิมสามารถมี Customer Role อยู่แล้วได้

ข้อมูลบุคคล:

- เลขประจำตัวประชาชน 13 หลัก
- คำนำหน้าชื่อ
- ชื่อ
- นามสกุล
- วันเดือนปีเกิด
- เบอร์โทรศัพท์
- ที่อยู่ตามทะเบียนบ้าน
- รหัสผ่านและยืนยันรหัสผ่าน

ข้อมูลร้านค้า:

- ชื่อร้านค้า
- ประเภทร้านค้า
- เลขประจำตัวผู้เสียภาษี ถ้ามี
- เบอร์โทรศัพท์ร้านค้า
- รายละเอียดร้านค้า
- ที่อยู่ร้านค้า
- แขวงหรือตำบล
- เขตหรืออำเภอ
- จังหวัด
- รหัสไปรษณีย์
- การยอมรับข้อกำหนดสำหรับร้านค้า
- การรับทราบนโยบายความเป็นส่วนตัว

กฎการลงทะเบียน:

- หาก Citizen ID ยังไม่มี ให้สร้าง User Identity และ Role `MERCHANT`
- หาก Citizen ID มีอยู่แล้ว ต้องยืนยัน Password ของ Identity เดิมก่อนเพิ่ม Role `MERCHANT`
- ห้ามสร้าง User ซ้ำสำหรับ Citizen ID เดิม
- สร้าง Merchant Entity แยกจาก User Identity
- สร้างความสัมพันธ์ใน `merchant_members`
- ผู้สมัครเป็น `OWNER` ของร้าน
- Merchant เริ่มต้นด้วยสถานะ `PENDING`
- Merchant ต้องได้รับอนุมัติจาก Admin ก่อนเปิด POS หรือรับชำระเงิน

การลงทะเบียน Merchant ต้องทำใน Database Transaction เดียว:

1. สร้างหรือยืนยัน User Identity
2. เพิ่ม Role `MERCHANT`
3. สร้าง Merchant
4. สร้าง Merchant Membership แบบ `OWNER`
5. สร้าง Merchant Wallet แยกจาก Consumer Wallet
6. กำหนด Merchant Status เป็น `PENDING`
7. บันทึกการยอมรับข้อกำหนด
8. บันทึก Audit Event

### FR-AUTH-03 — Password Policy

รหัสผ่านและยืนยันรหัสผ่านต้องตรงกัน

รหัสผ่านต้องมี:

- ความยาวอย่างน้อย 8 ตัวอักษร
- ตัวอักษรภาษาอังกฤษพิมพ์ใหญ่อย่างน้อย 1 ตัว (`A-Z`)
- ตัวอักษรภาษาอังกฤษพิมพ์เล็กอย่างน้อย 1 ตัว (`a-z`)
- ตัวเลขอย่างน้อย 1 ตัว (`0-9`)
- อักขระพิเศษอย่างน้อย 1 ตัว เช่น `!@#$%^&*`
- ต้องไม่เหมือน Citizen ID

ตัวอย่างรหัสผ่านที่ผ่านเงื่อนไข:

```text
ThaiPlease@2026
```

ข้อกำหนดด้านความปลอดภัย:

- Hash ด้วย Argon2id หรือ Password Hashing Algorithm ที่ได้รับการยอมรับ
- ห้ามเก็บ Plain Text Password
- ห้ามบันทึก Password ใน Log, Audit Event หรือ Error Response
- ใช้ข้อความ Login Error แบบเดียวกันเพื่อป้องกัน Account Enumeration
- มี Rate Limiting และการป้องกัน Brute Force

### FR-AUTH-04 — Login

Login Request ต้องมี:

```json
{
  "citizen_id": "1101700203451",
  "password": "ThaiPlease@2026"
}
```

API แยกตาม Portal:

```text
POST /api/v1/auth/customer/login
POST /api/v1/auth/merchant/login
POST /api/v1/auth/admin/login
```

Backend ต้องตรวจ:

- Citizen ID และ Password
- User Status
- Role ที่ตรงกับ Portal
- Role Status
- Merchant Status สำหรับ Merchant Portal
- Admin Status สำหรับ Admin Portal

Merchant สถานะ `PENDING` Login ได้เฉพาะหน้าติดตามสถานะ แต่ยังใช้ POS ไม่ได้

### FR-AUTH-05 — Admin Creation

ระบบไม่มี Public Registration สำหรับ Admin

Admin ใหม่สร้างหรือมอบ Role ได้โดย Admin ที่มีสิทธิ์ `ADMIN_MANAGE` เท่านั้น

- ถ้า Citizen ID ยังไม่มี ให้สร้าง User Identity พร้อม Temporary Password
- ถ้า Citizen ID มีอยู่แล้ว ให้เพิ่ม Role `ADMIN` โดยไม่เปลี่ยน Password เดิม
- ต้องบันทึก `created_by_admin_id`
- User ใหม่ต้องเปลี่ยน Temporary Password เมื่อ Login ครั้งแรก
- ห้าม Public Client กำหนด Role `ADMIN`
- ห้ามปิดใช้งาน Admin คนสุดท้ายที่ Active
- ทุกการสร้าง ระงับ หรือถอน Admin Role ต้องมี Audit Event

### FR-AUTH-06 — Initial Admin

Initial Admin สร้างผ่าน Secure Seed, Bootstrap Command หรือ Deployment Provisioning Script

- ห้ามมี Default Password ใน Source Code
- Credential ต้องมาจาก Secret หรือ Environment ที่ปลอดภัย
- Bootstrap ต้องทำซ้ำอย่างปลอดภัย
- ต้องไม่สร้าง Initial Admin ซ้ำ
- ต้องบังคับเปลี่ยนรหัสผ่านเมื่อ Login ครั้งแรก
- ต้องบันทึก Audit Event

---

## 5. Wallet Ownership Model

### 5.1 Consumer Wallet

Consumer Wallet เป็นของ User Identity ในบริบท `CONSUMER`

เก็บยอด:

```text
personal_balance
subsidy_balance
```

- User หนึ่งคนมี Consumer Wallet ได้หนึ่งบัญชี
- ใช้สำหรับเติมเงินส่วนตัว รับ Subsidy และชำระ Order
- เงิน Subsidy ถอนหรือย้ายเป็น Personal Balance ไม่ได้

### 5.2 Merchant Wallet

Merchant Wallet เป็นของ Merchant Entity ไม่ใช่ของ User Identity

เก็บยอด:

```text
merchant_balance
```

- Merchant หนึ่งร้านมี Merchant Wallet หนึ่งบัญชี
- Merchant Wallet รับยอด `final_amount` เมื่อ Payment สำเร็จ
- Merchant Wallet ไม่ใช้ Personal Balance หรือ Subsidy Balance
- เจ้าของร้านหลายคนเข้าถึง Wallet เดียวกันได้ตาม Merchant Membership
- บุคคลเดียวกันอาจมีทั้ง Consumer Wallet และสิทธิ์เข้าถึง Merchant Wallet แต่ทั้งสอง Wallet ต้องเป็นคนละบัญชี
- Merchant Wallet มีปุ่มถอนเงิน โดยเป็นการโอน Virtual Money ภายในระบบไปยัง `personal_balance` ของ Consumer Wallet ของผู้ถอน
- การถอนเงินไม่ใช่การถอนเข้าบัญชีธนาคารและไม่มี Payment Gateway
- เฉพาะ Merchant Member ที่มีสิทธิ์ `OWNER` เท่านั้นที่ถอนเงินได้
- ผู้ถอนต้องมี Role `CONSUMER` และมี Consumer Wallet ก่อนทำรายการ

ตัวอย่าง:

```text
User ID 101
├── Consumer Wallet ID 501
│   ├── Personal Balance
│   └── Subsidy Balance
└── OWNER ของ Merchant ID 301
    └── Merchant Wallet ID 801
        └── Merchant Balance
```

### 5.3 Wallet Schema Direction

ใช้ตาราง `wallets` เดียวโดยแยกเจ้าของด้วย:

```text
wallet_type: CONSUMER | MERCHANT
user_id: nullable
merchant_id: nullable
```

Database Constraint ต้องบังคับว่า:

- `CONSUMER` ต้องมี `user_id` และไม่มี `merchant_id`
- `MERCHANT` ต้องมี `merchant_id` และไม่มี `user_id`
- User หนึ่งคนมี Consumer Wallet ได้หนึ่งบัญชี
- Merchant หนึ่งร้านมี Merchant Wallet ได้หนึ่งบัญชี

`wallet_transactions` ต้องอ้าง `wallet_id` เพื่อให้รองรับ Transaction ของทั้งสองประเภท

---

## 6. Consumer Requirements

### FR-C01 — Consumer Overview

Consumer ดูข้อมูลต่อไปนี้ได้:

- ข้อมูลส่วนตัว
- Personal Balance
- Subsidy Balance
- Point Balance
- Subsidy ที่ใช้วันนี้
- Subsidy ที่เหลือวันนี้
- Quest ที่ได้รับ
- Coupon ที่มี
- Order ล่าสุด

Consumer ต้องเห็นเฉพาะข้อมูลของตนเอง

### FR-C02 — Personal Top-up

- เติมได้เฉพาะ Personal Balance
- ไม่เพิ่ม Subsidy Balance
- เป็น Virtual Top-up เท่านั้น
- สร้าง Wallet Transaction ประเภท `PERSONAL_TOPUP`
- ต้องใช้ Idempotency Key
- ยอดศูนย์ ยอดติดลบ หรือเกินเพดานต้องถูกปฏิเสธ

### FR-C03 — Daily Subsidy Status

Consumer ดูได้:

- Subsidy Balance
- Daily Subsidy Cap
- Subsidy Used Today
- Subsidy Remaining Today
- Subsidy Percentage
- ชื่อและช่วงเวลาของ Subsidy Program

ยอดรายวันคำนวณจาก `wallet_transactions` ตามวันใน `Asia/Bangkok` โดยไม่ Reset ข้อมูลตอนเที่ยงคืน

### FR-C04 — Scan and Review QR

Consumer ต้องเห็นก่อนชำระ:

- ร้านค้า
- รายการสินค้า
- จำนวนและราคาต่อหน่วย
- Line Total
- Subtotal
- Coupon และ Discount
- Final Amount
- Subsidy ที่คาดว่าจะใช้
- Personal Amount ที่ต้องจ่าย
- เวลาหมดอายุ QR

### FR-C05 — Payment

- ใช้ Consumer Wallet
- ใช้ Subsidy ตามสิทธิ์
- ใช้ Coupon ได้เมื่อผ่านเงื่อนไข
- Backend คำนวณยอดทั้งหมดใหม่
- ทำงานแบบ Atomic และ Idempotent
- ต้องไม่ชำระซ้ำ

### FR-C06 — Order History and Receipt

Consumer ดู Paid Orders และ Receipt ที่สร้างจาก `orders` กับ `order_items` ได้

Receipt แสดง:

- Merchant Snapshot
- Item Snapshots
- Subtotal
- Discount
- Final Amount
- Subsidy Paid
- Personal Paid
- Coupon
- Paid At

### FR-C07 — Personalized Quest

- ระบบเสนอเควสที่ผ่าน validation สูงสุด 3 ข้อ ให้ Consumer เลือก 1 ข้อก่อนมอบหมาย (การเปลี่ยนข้อกำหนดที่ผู้ใช้อนุมัติ 28 ตุลาคม 2026)
- อายุเควสและรอบรับเควส 7 วันเริ่มเมื่อเลือกสำเร็จ ทำเสร็จก่อนก็ต้องรอครบรอบเดิม
- ข้อเสนอทั้งสามให้ 20 พอยต์เท่ากัน ไม่เพิ่มตามยอดใช้จ่าย; Backend เป็นผู้กำหนดรางวัลและตรวจงบ
- แสดงเงื่อนไข Reward สถานะ และวันหมดอายุ
- ใช้ Order เดียวในการสำเร็จ
- รองรับเควสใหม่เฉพาะ `MIN_SPEND` และ `CATEGORY_SPEND` ซื้อได้จากร้านที่เข้าร่วมใดก็ได้
- ไม่สร้างเควสผูก `product_id`, ค้นชื่อสินค้า หรือบังคับ `merchant_id`
- หมวดอ้างอิง `category_id` กลาง; ตรวจจาก category snapshot ของรายการในบิล
- เควสสินค้า/ร้านที่ยัง ACTIVE จากรุ่นเก่าให้ยกเลิกเป็น `CANCELLED` พร้อมเวลาและเหตุผล `QUEST_TYPE_RETIRED_POLICY_V2`; ไม่แก้เงื่อนไขย้อนหลัง ไม่ลบประวัติหรือแต้มที่ออกแล้ว

### FR-C08 — Point

Consumer ดู Point Balance, Point History, แหล่งที่มา และวันหมดอายุได้

### FR-C09 — Coupon

Consumer ดู Catalogue, แลก Point, ดู Coupon ของตน และเลือก Coupon เพื่อชำระเงินได้

---

## 7. Merchant Requirements

### FR-M01 — Merchant Approval

- ร้านใหม่เป็น `PENDING`
- Admin อนุมัติเป็น `ACTIVE`
- ร้าน `PENDING`, `REJECTED` หรือ `SUSPENDED` ใช้ POS และรับชำระเงินไม่ได้

### FR-M02 — Product Management

Merchant ที่ Active สามารถเพิ่ม แก้ไข และปิดการใช้งานสินค้า รวมทั้งกำหนดหมวดหมู่และราคา

- Merchant แก้ได้เฉพาะสินค้าของร้านที่มีสิทธิ์
- Product Deactivation ไม่ลบประวัติ
- ราคาและหมวดหมู่ต้องผ่าน Backend Validation

### FR-M03 — POS

Merchant เลือกสินค้าและจำนวนเพื่อสร้าง Order หลายรายการได้

Backend ต้องอ่านราคาจากฐานข้อมูลและคำนวณ:

```text
line_total = unit_price × quantity
subtotal = sum(line_total)
final_amount = max(0, subtotal - discount_amount)
```

### FR-M04 — QR Generation

- QR ผูกกับ Order เดียว
- Token คาดเดาไม่ได้
- เก็บเฉพาะ Hash
- มีวันหมดอายุ
- ใช้ชำระได้ครั้งเดียว
- QR Payload ไม่เป็นแหล่งข้อมูลราคาที่เชื่อถือได้

### FR-M05 — Payment Status

Merchant ดูสถานะได้:

```text
DRAFT
CHECKED_OUT
PAID
EXPIRED
```

ต้องไม่แสดง `PAID` ก่อน Transaction การหัก Consumer Wallet และเครดิต Merchant Wallet Commit สำเร็จ

### FR-M06 — Merchant Wallet

Merchant ที่มีสิทธิ์ดูได้:

- Merchant Balance
- รายรับจากแต่ละ Order
- Wallet Transaction History
- Subsidy Portion
- Personal Portion
- Final Amount ที่ได้รับ
- ปุ่มถอนเงินจาก Merchant Wallet

การถอนเงินใน Prototype เป็น Internal Wallet Transfer เท่านั้น:

```text
Merchant Wallet
→ Consumer Wallet.personal_balance ของ Merchant Owner ผู้ทำรายการ
```

ไม่ใช่การถอนเงินจริงเข้าบัญชีธนาคาร

เงื่อนไข:

- ผู้ทำรายการต้องมี Merchant Membership ระดับ `OWNER`
- ผู้ทำรายการต้องมี Active Consumer Role
- ผู้ทำรายการต้องมี Consumer Wallet
- จำนวนเงินต้องมากกว่าศูนย์
- จำนวนเงินต้องไม่เกิน Merchant Balance
- Merchant Balance และ Consumer Personal Balance ต้องเปลี่ยนพร้อมกัน
- ต้องสร้าง Wallet Transaction ทั้งฝั่ง Debit และ Credit
- ต้องใช้ Idempotency Key เพื่อป้องกันการถอนซ้ำ
- ถ้าขั้นตอนใดล้มเหลว ต้อง Rollback ทั้งหมด

### FR-M07 — Merchant Dashboard

แสดงอย่างน้อย:

- Total Sales
- Order Count
- Subsidy Received
- Personal Payment Received
- Coupon Orders
- Top-selling Products
- Sales Trend
- Data Freshness

### FR-M08 — Order and Receipt History

Merchant ดู Orders ของร้านและ Receipt View ได้ โดย Paid Order แก้ไข ยกเลิก ลบ หรือ Refund ไม่ได้

---

## 8. Administrator Requirements

### FR-A01 — Platform Overview

Admin ดูจำนวนผู้ใช้ ร้านค้า Paid Orders ยอดใช้จ่าย Subsidy Point Coupon และ Quest ได้

### FR-A02 — Merchant Approval

Admin ดู ตรวจ อนุมัติ ปฏิเสธ ระงับ และเปิดใช้งาน Merchant ได้ ทุกการเปลี่ยนสถานะต้องมี Audit Event

### FR-A03 — Admin Management

Admin ที่มีสิทธิ์สามารถเพิ่ม Admin Role ให้ Identity ใหม่หรือเดิม ระงับ Role เปิดใช้งาน และบังคับ Reset Password ได้

### FR-A04 — Subsidy Program Management

Admin สร้างและจัดการ:

- Program Name
- Initial Subsidy
- Subsidy Percentage
- Daily Subsidy Cap
- Currency
- Timezone
- Start At
- End At
- Status

การเปลี่ยน Program ห้ามเขียนทับข้อเท็จจริงของธุรกรรมเดิม

### FR-A05 — Quest Generation

Admin เรียก AI Quest Generation เลือก User หรือ Segment และดู Proposal, Validation Result, Provider, Model Version และ Generation Log ได้

### FR-A06 — Reward Monitoring

Admin ดู Quest Assignment, Completion, Point Issuance, Point Redemption, Coupon Issuance, Coupon Usage และ Expiry ได้

### FR-A07 — Social Impact Dashboard

แสดงอย่างน้อย:

- Active Consumers
- Participating Merchants
- Successful Orders
- Total Final Spend
- Total Subsidy Used
- Average Sales per Merchant
- Quest Assigned and Completed
- Quest Completion Rate
- Points Issued and Redeemed
- Coupons Issued and Used
- Coupon Usage Rate
- Sales by Merchant and Category
- Daily or Weekly Trend
- Metric Version, Reporting Timezone และ `as_of`

---

## 9. Wallet and Co-payment Rules

### BR-WALLET-01 — Prototype Policy

```text
initial_subsidy = 1,000 บาท
subsidy_percent = 60%
daily_subsidy_cap = 200 บาท
timezone = Asia/Bangkok
```

Policy ต้องมาจาก `subsidy_programs`

### BR-WALLET-02 — Daily Calculation

คำนวณยอด Subsidy Payment ภายในช่วง:

```text
bangkok_day_start <= occurred_at < next_bangkok_day_start
```

### BR-WALLET-03 — Allocation

```text
target_subsidy = floor(final_amount × subsidy_percent / 100)
daily_remaining = max(0, daily_cap - subsidy_used_today)
subsidy_paid = min(target_subsidy, daily_remaining, subsidy_balance)
personal_paid = final_amount - subsidy_paid
```

ตัวอย่าง:

```text
Final Amount = 100
Subsidy Paid = 60
Personal Paid = 40
```

เมื่อสิทธิ์เหลือ 20 บาท:

```text
Final Amount = 100
Subsidy Paid = 20
Personal Paid = 80
```

### BR-WALLET-04 — Insufficient Balance

ถ้า Personal Balance ไม่พอ ต้องปฏิเสธ Payment และห้ามเปลี่ยน Wallet, Coupon, Order, Quest หรือ Point ใด ๆ

### BR-WALLET-05 — Double-entry Business Outcome

เมื่อ Payment สำเร็จ:

- Debit Consumer Subsidy Balance ตาม `subsidy_paid`
- Debit Consumer Personal Balance ตาม `personal_paid`
- Credit Merchant Wallet เท่ากับ `final_amount`
- สร้าง Wallet Transactions สำหรับทุก Value Movement

สมการต้องเป็น:

```text
subsidy_paid + personal_paid = final_amount
merchant_credit = final_amount
```

ทั้งหมดต้อง Commit ใน Database Transaction เดียว

### BR-WALLET-06 — Merchant Withdrawal to Consumer Wallet

การกดถอนเงินจาก Merchant Wallet เป็นการโอน Virtual Money ไปยัง Consumer Wallet ของ Merchant Owner ผู้ทำรายการ

ระบบต้องดำเนินการใน Database Transaction เดียว:

1. ตรวจ Idempotency Record
2. ตรวจ Session ว่าอยู่ใน Merchant Portal
3. ตรวจ Merchant Context
4. ตรวจว่าผู้ทำรายการเป็น Merchant Member ระดับ `OWNER`
5. ตรวจว่าผู้ทำรายการมี Active Consumer Role
6. Lock Merchant Wallet
7. Lock Consumer Wallet ของผู้ทำรายการ
8. ตรวจจำนวนเงินและ Merchant Balance
9. Debit `merchant_balance`
10. Credit `consumer personal_balance`
11. สร้าง Merchant Wallet Transaction ประเภท `MERCHANT_WITHDRAWAL`
12. สร้าง Consumer Wallet Transaction ประเภท `MERCHANT_WITHDRAWAL_CREDIT`
13. บันทึก Business Reference และ Correlation ID เดียวกัน
14. บันทึก Idempotency Result
15. Commit

สมการ:

```text
merchant_wallet_debit = withdrawal_amount
consumer_personal_credit = withdrawal_amount
```

ข้อจำกัด:

- ห้าม Credit เข้า `subsidy_balance`
- ห้ามถอนเกิน Merchant Balance
- ห้าม Manager หรือ Cashier ถอนเงิน
- ห้ามเลือก Consumer Wallet ของบุคคลอื่นเป็นปลายทาง
- Retry ต้องคืนผลเดิมและไม่โอนซ้ำ
- Prototype ไม่มีค่าธรรมเนียมการถอน
- Paid Order และยอดขายย้อนหลังต้องไม่เปลี่ยนเมื่อถอนเงิน

---

## 10. Order, QR and Payment Rules

### BR-ORDER-01 — Server-side Pricing

Frontend ส่ง Product ID และ Quantity แต่ Backend อ่าน Product, Price และ Category จากฐานข้อมูล

### BR-ORDER-02 — Historical Snapshot

`order_items` เก็บ Product Name, Category, Unit Price, Quantity, Line Total และ Currency Snapshot

`orders` เก็บ Merchant Name, Subtotal, Discount, Final Amount, Subsidy Paid, Personal Paid, Coupon และ Paid At Snapshot

### BR-PAY-01 — Atomic Payment

Payment Transaction ต้อง:

1. ตรวจ Idempotency Record
2. Lock Order
3. ตรวจ Order, QR Token และ Expiry
4. Lock Consumer Wallet
5. Lock Merchant Wallet
6. Lock Coupon ถ้ามี
7. Recalculate Pricing จากฐานข้อมูล
8. คำนวณ Subsidy และ Personal Payment
9. ตรวจ Personal Balance
10. Debit Consumer Wallet
11. Credit Merchant Wallet
12. สร้าง Wallet Transactions
13. เปลี่ยน Coupon เป็น `USED`
14. เปลี่ยน Order เป็น `PAID`
15. บันทึก Paid Snapshot
16. สร้าง Outbox Event
17. บันทึก Idempotency Result
18. Commit

### BR-PAY-02 — Paid Order Immutability

Paid Order แก้ไข ยกเลิก ลบ หรือ Refund ไม่ได้

### BR-PAY-03 — Receipt

Receipt สร้างจาก `orders` และ `order_items` ไม่ต้องมี `receipts` หรือ `receipt_items`

---

## 11. Quest and AI Requirements

### FR-S01 — Quest Generation

AI วิเคราะห์สรุป PAID Orders ย้อนหลัง 30 วันจากเงินส่วนตัวหลังส่วนลด ไม่รวมรัฐช่วย: จำนวนบิล ค่าเฉลี่ย มัธยฐาน การกระจายยอด และข้อมูลแยก snapshot category พร้อมประวัติเควส 90 วัน/ล่าสุด 10 รายการ แยกฐานเงิน/เวอร์ชันและการยกเลิกโดยระบบ ไม่ส่ง PII ที่ไม่จำเป็น

### FR-S02 — Provider Abstraction

AI ทำหน้าที่เสนอ Quest เท่านั้น ไม่มีสิทธิ์อนุมัติ Payment, เพิ่ม Point, สร้าง Coupon หรือเปลี่ยน Quest Completion

### FR-S03 — Output Validation

AI Output ต้องผ่าน Schema, Rule Allow-list, Spend, Reward, Expiry, Category, Duplicate, Budget และ Policy Validation

Generation policy v3 ให้ AI เสนอสูงสุด 3 ข้อจาก `MIN_SPEND` และ `CATEGORY_SPEND` โดยระบุเฉพาะประเภท หมวด และยอดเงินส่วนตัว เป้าหมายบวกหน่วยละ 10 บาท ไม่มีเพดานธุรกิจ 100 บาท แต่ต้องแทนค่าได้ตาม Decimal schema ไม่ใช้สูตรตัวคูณหรือเพดาน candidate 4/8 เดิม Backend ควบคุมข้อความ/พอยต์/อายุ ไม่ให้ AI เปลี่ยนเป็นกฎสินค้า/ร้านหรือหลายบิล

เก็บข้อที่ผ่านแล้วขอเติมส่วนที่ขาด รวมไม่เกิน 2 provider calls ต่อชุด แสดง 1–2 ข้อได้ หากไม่ผ่านเลยไม่มอบเควสและไม่เสียสิทธิ์รอบรับ ค่าเริ่มต้นชุดข้อเสนออายุ 24 ชั่วโมง สร้างไม่เกิน 3 ชุดต่อวันและพัก 15 นาทีหลังสร้างล้มเหลว ปรับผ่าน validated policy

### FR-S04 — Generation Log

`quest_generation_logs` เก็บ Provider, Model Version, Prompt Version, Policy Version, Input Summary, Output, Validation Result, Rejection Reason, Quest ID, Requested By และ Created At

### FR-S05 — Proposal Selection and Assignment

ระบบสร้างข้อเสนอเมื่อ Consumer ถึงสิทธิ์และขอสร้างจากหน้าเควส ไม่เรียก AI ทุกครั้งที่อ่านหน้า ชุดเดิมที่ยังใช้ได้ต้องใช้ต่อ งานเรียก AI ใช้ durable PostgreSQL log queue พร้อม lease และ failed state ผู้ใช้เลือกได้เพียงหนึ่งข้อแม้ retry/concurrent request และตรวจสิทธิ์ หมวด policy และ budget ซ้ำใน transaction ก่อน assignment รอบถัดไปคือเวลาเลือกสำเร็จ + 7 วัน ไม่ใช่เวลาทำเสร็จ จองงบรางวัลเมื่อเลือก ไม่จองจากทุกข้อเสนอ

### FR-S06 — Deterministic Completion

- ตรวจหลัง Order เป็น `PAID`
- ใช้ Order เดียว
- ไม่สะสมหลาย Order
- ใช้เงินส่วนตัวหลังส่วนลด (`user_paid_amount`) ไม่รวมรัฐช่วยสำหรับเควสใหม่ เก็บ amount basis บน definition เพื่ออธิบายประวัติรุ่นเก่า
- หมวดใช้การจัดสรรเงินส่วนตัวผ่านสัดส่วนยอดรายการสุทธิหลังส่วนลดแบบ exact largest remainder โดยวิธีเดียวกันใน summary และ completion
- ใช้ Snapshot Category
- Reward ได้ครั้งเดียว

ตัวอย่าง:

```text
Quest: จ่ายเงินส่วนตัวหมวดอาหารครบ 100 บาทในหนึ่ง Order
Subtotal = 100
Discount = 10
Final Amount = 90
State Subsidy = 40
Personal Contribution = 50
ผลลัพธ์: ไม่สำเร็จ
```

---

## 12. Point and Coupon Requirements

### BR-POINT-01 — Point Balance

- เก็บ Current Balance ใน `users.point_balance`
- ทุกการเปลี่ยน Point มี `point_transactions`
- Balance และ Transaction เปลี่ยนใน Transaction เดียว
- Point Balance ติดลบไม่ได้

### BR-POINT-02 — Expiration

- Point มีวันหมดอายุ
- Point หมดอายุใช้ไม่ได้
- Expiry ต้องบันทึกเพียงครั้งเดียว
- ใช้ Point ที่หมดอายุก่อนตาม FIFO by Expiry

### BR-COUPON-01 — Redemption

การแลก Coupon ต้อง Lock Point, ตรวจ Point, หัก Point, สร้าง Point Transaction และ User Coupon ใน Transaction เดียว

### BR-COUPON-02 — Usage

Coupon ต้องเป็นของ Consumer, Active, ไม่หมดอายุ, ตรงเงื่อนไข และใช้ครั้งเดียว การเปลี่ยนเป็น `USED` ต้อง Atomic กับ Payment

---

## 13. Database Requirements

### 13.1 Identifier Policy

- Primary Key ใช้ `BIGSERIAL` หรือ `BIGINT`
- Foreign Key ใช้ `BIGINT`
- ไม่ใช้ UUID เป็น Entity ID
- Session และ QR Opaque Token ใช้ String/Hash ได้
- BIGINT ใน JSON API ส่งเป็น String เพื่อป้องกัน JavaScript Precision Loss

### 13.2 Main Domain Tables

ตารางหลักเดิม 15 ตาราง:

1. `users`
2. `wallets`
3. `wallet_transactions`
4. `subsidy_programs`
5. `merchants`
6. `product_categories`
7. `products`
8. `orders`
9. `order_items`
10. `quests`
11. `user_quests`
12. `point_transactions`
13. `coupons`
14. `user_coupons`
15. `quest_generation_logs`

### 13.3 Required Supporting Tables

ข้อกำหนด Multiple Roles และ Merchant Ownership จำเป็นต้องมี Supporting Tables:

- `user_roles`
- `auth_sessions`
- `merchant_members`
- `point_allocations`
- `idempotency_records`
- `outbox_events`
- `audit_events`

Supporting Tables ไม่ใช่รายการ Domain Table หลัก แต่จำเป็นต่อความถูกต้องและความปลอดภัย

### 13.4 User Fields

```text
id
citizen_id
password_hash
title
first_name
last_name
date_of_birth
phone_number
address fields
status
point_balance
must_change_password
terms_accepted_at
privacy_accepted_at
last_login_at
created_at
updated_at
```

### 13.5 Wallet Fields

```text
id
wallet_type
user_id nullable
merchant_id nullable
currency
personal_balance
subsidy_balance
merchant_balance
version
created_at
updated_at
```

### 13.6 Merchant Fields

```text
id
name
category_id
tax_id
phone_number
description
address fields
status
approved_by_admin_id
approved_at
rejected_at
created_at
updated_at
```

### 13.7 Subsidy Program Fields

```text
id
name
description
initial_subsidy
subsidy_percent
daily_subsidy_cap
currency
timezone
start_at
end_at
status
created_by_admin_id
created_at
updated_at
```

---

## 14. API Requirements

### Authentication

| Method | Endpoint                  | สิทธิ์                          |
| ------ | ------------------------- | ------------------------------- |
| `POST` | `/auth/register/customer` | Public/New or existing identity |
| `POST` | `/auth/register/merchant` | Public/New or existing identity |
| `POST` | `/auth/customer/login`    | Consumer Role                   |
| `POST` | `/auth/merchant/login`    | Merchant Role                   |
| `POST` | `/auth/admin/login`       | Admin Role                      |
| `POST` | `/auth/logout`            | Authenticated                   |
| `GET`  | `/users/me`               | Authenticated                   |
| `GET`  | `/users/me/roles`         | Authenticated                   |

### Consumer Wallet

| Method | Endpoint               | สิทธิ์   |
| ------ | ---------------------- | -------- |
| `GET`  | `/wallet`              | Consumer |
| `GET`  | `/wallet/transactions` | Consumer |
| `GET`  | `/wallet/subsidy`      | Consumer |
| `POST` | `/wallet/topup`        | Consumer |

### Merchant Wallet

| Method | Endpoint                             | สิทธิ์                            |
| ------ | ------------------------------------ | --------------------------------- |
| `GET`  | `/merchants/:id/wallet`              | Merchant Member                   |
| `GET`  | `/merchants/:id/wallet/transactions` | Merchant Member                   |
| `POST` | `/merchants/:id/wallet/withdrawals`  | Merchant Owner with Consumer Role |

### Product, Order and Payment

| Method   | Endpoint                    | สิทธิ์                    |
| -------- | --------------------------- | ------------------------- |
| `GET`    | `/product-categories`       | Authenticated             |
| `POST`   | `/products`                 | Active Merchant           |
| `PATCH`  | `/products/:id`             | Product Owner Merchant    |
| `DELETE` | `/products/:id`             | Product Owner Merchant    |
| `POST`   | `/orders`                   | Active Merchant           |
| `POST`   | `/orders/:id/items`         | Related Merchant          |
| `DELETE` | `/orders/:id/items/:itemId` | Related Merchant          |
| `POST`   | `/orders/:id/checkout`      | Related Merchant          |
| `GET`    | `/payments/qr/:token`       | Consumer                  |
| `POST`   | `/orders/:id/coupon`        | Consumer                  |
| `POST`   | `/orders/:id/pay`           | Consumer                  |
| `GET`    | `/orders/:id/receipt`       | Related Consumer/Merchant |

### Quest, Point and Coupon

| Method | Endpoint              | สิทธิ์   |
| ------ | --------------------- | -------- |
| `GET`  | `/quests`             | Consumer |
| `GET`  | `/points`             | Consumer |
| `GET`  | `/coupons`            | Consumer |
| `POST` | `/coupons/:id/redeem` | Consumer |

### Administrator

| Method           | Endpoint                           | สิทธิ์       |
| ---------------- | ---------------------------------- | ------------ |
| `POST`           | `/admin/users/:userId/roles/admin` | Admin Manage |
| `GET`            | `/admin/users/admins`              | Admin Manage |
| `POST`           | `/admin/merchants/:id/approve`     | Admin        |
| `POST`           | `/admin/merchants/:id/reject`      | Admin        |
| `GET/POST/PATCH` | `/admin/subsidy-programs`          | Admin        |
| `POST`           | `/admin/quests/generate`           | Admin        |
| `GET`            | `/admin/quest-generation-logs`     | Admin        |
| `GET`            | `/admin/dashboard/social-impact`   | Admin        |

---

## 15. Authorization Requirements

- Consumer Session เข้าถึงเฉพาะ Consumer Wallet, Orders, Quests, Points และ Coupons ของตน
- Merchant Session เข้าถึงเฉพาะ Merchants ที่มี Membership และต้องระบุ Merchant Context
- เฉพาะ Merchant Membership ระดับ `OWNER` เท่านั้นที่ถอน Merchant Balance เข้า Consumer Wallet ของตนได้
- Admin Session เข้าถึงเฉพาะ Admin Capabilities ตาม Permission
- การมีหลาย Role ไม่อนุญาตให้ข้ามสิทธิ์ระหว่าง Session Context
- Backend เป็นผู้บังคับ Authorization ทุก Endpoint
- การซ่อนปุ่มใน Frontend ไม่ถือเป็น Authorization

---

## 16. Security and Privacy

- Validate Input ทุก Trust Boundary
- Reject Unknown Fields เมื่อเหมาะสม
- Parameterized Queries เท่านั้น
- Hash Password, Session Token และ QR Token
- Mask Citizen ID
- ห้าม Log Password หรือ Token เต็ม
- Rate Limit Login, Registration และ Value-moving Endpoints
- ป้องกัน Account Enumeration
- ป้องกัน QR Replay, Double Payment, Double Coupon Use และ Double Reward
- ป้องกัน Duplicate Merchant Withdrawal และการถอนเข้า Wallet ของบุคคลอื่น
- Audit การสร้าง Admin การอนุมัติร้านค้า และ Policy Changes
- ส่งข้อมูลส่วนบุคคลให้ AI เท่าที่จำเป็น
- ไม่อ้างว่า Prototype ผ่าน PDPA หรือมาตรฐานใดโดยไม่มีการประเมินอย่างเป็นทางการ

---

## 17. Non-functional Requirements

### NFR-DATA-01 — Transactional Integrity

Wallet, Payment, Merchant Credit, Coupon และ Point ต้องถูกต้องภายใต้ Duplicate Request, Concurrent Request, Timeout, Restart และ Event Replay

### NFR-DATA-02 — Exact Arithmetic

ห้ามใช้ Binary Floating Point สำหรับเงินและ Point

### NFR-TIME-01 — Time

- เก็บ Timestamp เป็น UTC
- ใช้ `Asia/Bangkok` สำหรับวันธุรกิจ
- Expiry เป็นแบบ Exclusive: ใช้ได้เมื่อ `now < expires_at`

### NFR-UX-01 — UI States

หน้าหลักต้องมี Loading, Empty, Error, Success, Permission Denied, Expired และ Duplicate Submission Prevention

### NFR-ACC-01 — Accessibility

ใช้ Semantic HTML, Keyboard Navigation, Visible Focus, Accessible Labels และตั้งเป้า WCAG 2.2 AA

### NFR-I18N-01 — Localization

ข้อความที่ผู้ใช้เห็นอยู่ใน Typed Localization Resource โดยใช้ภาษาไทยเป็นภาษาหลัก

### NFR-OBS-01 — Observability

มี Request ID, Correlation ID, Structured Logs, Audit Events, Payment Metrics, Reward Metrics และ Reconciliation Reports

---

## 18. Current Repository Alignment

สิ่งที่มีแล้ว:

- React/Vite Frontend Skeleton
- NestJS/Prisma Backend
- Citizen ID Login แบบไม่มี Password
- Wallet และ Virtual Top-up
- Daily Subsidy Calculation
- Merchant, Product, POS, Order และ QR
- Atomic Consumer Payment
- Coupon, Quest และ Point Ledger
- Merchant และ Social Impact Dashboard
- Idempotency, Outbox และ Audit Schema

สิ่งที่ต้องปรับ:

| ของเดิม                           | เป้าหมายใหม่                                                             |
| --------------------------------- | ------------------------------------------------------------------------ |
| `users.role` ค่าเดียว             | เพิ่ม `user_roles` เพื่อรองรับ 3 Roles ต่อบุคคล                          |
| Login Endpoint เดียว              | แยก Customer/Merchant/Admin Portal Login                                 |
| ไม่มี Password                    | เพิ่ม Password Hash และ Password Policy                                  |
| ไม่มี Registration                | เพิ่ม Customer และ Merchant Registration                                 |
| Wallet ผูก User อย่างเดียว        | รองรับ Consumer Wallet และ Merchant Wallet แยกกัน                        |
| Payment Debit Consumer อย่างเดียว | Credit Merchant Wallet ใน Transaction เดียวกัน                           |
| ไม่มี Merchant Withdrawal         | เพิ่ม Internal Transfer จาก Merchant Wallet ไป Consumer Personal Balance |
| Merchant Active ทันที             | เพิ่ม Approval Workflow                                                  |
| Admin จาก Seed ทั่วไป             | Secure Bootstrap และ Admin-only Role Grant                               |
| Prisma `Int`                      | เปลี่ยนเป็น `BigInt`                                                     |
| ไม่มี `subsidy_programs`          | เพิ่ม Program Table และ Admin Management                                 |
| ไม่มี `quest_generation_logs`     | เพิ่ม AI Generation Audit                                                |
| Point Derived อย่างเดียว          | เพิ่ม `users.point_balance` และ Reconciliation                           |
| มี Receipt Tables                 | Backfill แล้วสร้าง Receipt จาก Order                                     |
| Frontend เป็น Landing Page        | พัฒนา 3 Portals                                                          |

---

## 19. Migration Requirements

1. สำรองและตรวจ Schema/Data เดิม
2. เพิ่ม User Profile และ Password Fields
3. เพิ่ม `user_roles` และ Backfill จาก `users.role`
4. ปรับ Session ให้เก็บ Active Role และ Merchant Context
5. เพิ่ม Merchant Status และ Approval Fields
6. ปรับ Wallet Ownership ให้รองรับ Consumer/Merchant
7. สร้าง Merchant Wallet สำหรับร้านเดิม
8. เพิ่ม Merchant Credit ใน Payment Transaction
9. เพิ่ม Merchant Withdrawal Transaction Types และ Idempotent Transfer Service
10. เพิ่ม Subsidy Program และ Backfill Wallet เดิม
11. เพิ่ม Point Balance และ Reconcile จาก Ledger
12. เพิ่ม Quest Generation Logs
13. เพิ่ม Order Snapshot ที่ขาด
14. Backfill Receipt Facts เข้า Orders/Order Items
15. เลิกใช้ Receipt Tables หลัง Validation
16. เปลี่ยน IDs เป็น BIGINT ด้วย Migration ที่ตรวจสอบได้
17. ปรับ API Contract, Seed และ Tests

ห้ามทำ Destructive Migration จนกว่าจะทราบว่า Neon Database มีข้อมูลที่ต้องรักษาหรือสามารถ Reset ได้

---

## 20. Testing Requirements

### Unit

- Citizen ID Check Digit
- Password uppercase/lowercase/number/special rules
- Role and Portal Authorization
- Co-payment Allocation
- Bangkok Day Boundary
- Merchant Credit
- Pricing and Discount
- Quest Rule
- Point Expiry
- Coupon Eligibility

### Integration

- Register Identity ใหม่
- เพิ่ม Consumer Role ให้ Identity เดิม
- เพิ่ม Merchant Role ให้ Identity เดิม
- Admin เพิ่ม Admin Role ให้ Identity เดิม
- Consumer Wallet และ Merchant Wallet แยกกัน
- Customer Payment Debit และ Merchant Credit แบบ Atomic
- Merchant Owner ถอน Merchant Balance เข้า Consumer Personal Balance แบบ Atomic
- Manager และ Cashier ถอน Merchant Balance ไม่ได้
- Duplicate Merchant Withdrawal ไม่โอนเงินซ้ำ
- Concurrent Payment
- Duplicate Payment
- Coupon Double Use
- Point Double Reward
- Idempotency และ Database Constraints

### End-to-End

1. Customer Register/Login
2. Merchant Register ด้วย Citizen ID เดียวกับ Customer
3. Login แยก Customer และ Merchant Portal
4. Admin เพิ่ม Admin Role ให้ User เดิม
5. Login Admin Portal
6. Admin อนุมัติ Merchant
7. Merchant สร้างสินค้า Order และ QR
8. Customer ชำระเงิน
9. Consumer Wallet ถูกหักถูกต้อง
10. Merchant Wallet ได้รับ Final Amount
11. Merchant Owner ถอนบางส่วนเข้า Consumer Personal Balance
12. Merchant และ Consumer Wallet Transactions แสดงรายการโอนที่สัมพันธ์กัน
13. Receipt แสดงจาก Order
14. Quest Completion และ Point Reward
15. Point-to-Coupon Redemption
16. Coupon ใช้ได้ครั้งเดียว
17. Merchant และ Social Impact Dashboard

---

## 21. Prototype Demo Acceptance Flow

1. บุคคลลงทะเบียน Customer
2. บุคคลเดียวกันลงทะเบียน Merchant ด้วย Identity เดิม
3. ระบบมี User หนึ่งรายการและสอง Roles
4. ระบบมี Consumer Wallet หนึ่งบัญชี
5. ร้านค้ามี Merchant Wallet แยกอีกหนึ่งบัญชี
6. Admin เพิ่ม Admin Role ให้บุคคลเดิมได้
7. บุคคล Login ได้ทั้งสาม Portal โดยแต่ละ Session มีสิทธิ์แยกกัน
8. Admin อนุมัติร้านค้า
9. Merchant สร้าง Product และ Order
10. Merchant สร้าง QR
11. Customer ตรวจและชำระ
12. ระบบหัก Subsidy และ Personal Balance
13. ระบบเครดิต Final Amount เข้า Merchant Wallet
14. Merchant Owner กดถอนเงินบางส่วน
15. ระบบ Debit Merchant Wallet และ Credit Consumer Personal Balance ใน Transaction เดียว
16. Order เปลี่ยนเป็น `PAID`
17. Customer และ Merchant เปิด Receipt View ได้
18. ระบบตรวจ Quest และมอบ Point ครั้งเดียว
19. Customer แลก Point เป็น Coupon
20. Coupon ใช้ได้ครั้งเดียว
21. Admin ดู Quest Generation และ Social Impact ได้
22. Value Movement ทั้งหมดตรวจสอบย้อนหลังได้

---

## 22. Open Decisions

1. Registration ต้องยืนยันเบอร์โทรศัพท์ด้วย OTP หรือไม่
2. ต้องใช้ Laser Code หลังบัตรประชาชนหรือไม่
3. ใช้ Mock Government Verification หรือเชื่อมระบบจริงในอนาคต
4. User หนึ่งคนสร้างหรือเป็นเจ้าของ Merchant ได้กี่ร้าน
5. ร้านที่มี OWNER หลายคนให้ OWNER ทุกคนถอนเข้า Consumer Wallet ของตนได้หรือจำกัดเฉพาะ Primary Owner
6. Admin Permission ใช้ Role เดียวหรือแยก Permission ย่อย
7. Neon Database มีข้อมูลที่ต้องรักษาหรือ Reset ได้
8. Subsidy Program Active พร้อมกันได้กี่โครงการ

---

## 23. Definition of Done

Requirement ถือว่าเสร็จเมื่อ:

- Behavior และ Authorization ถูกต้องทุก Portal
- Multiple Roles ทำงานโดยไม่สร้าง User ซ้ำ
- Consumer Wallet และ Merchant Wallet แยกกันจริง
- Payment Debit/Credit เป็น Atomic Transaction
- Merchant Withdrawal Debit/Credit เป็น Atomic และเข้าบัญชีของผู้ถอนเท่านั้น
- Retry ไม่สร้างรายการซ้ำ
- Database Constraints และ Migration ถูกตรวจสอบ
- Frontend รองรับ Happy Path และ Error States
- Unit, Integration และ End-to-End Tests ที่เกี่ยวข้องผ่าน
- API และเอกสารอัปเดตตรงกัน
- Audit และ Reconciliation พร้อมใช้งาน
- ไม่มี Password, Token หรือข้อมูลอ่อนไหวรั่วใน Log
- Demo Flow ทำงานครบตั้งแต่ Registration ถึง Coupon Reuse
