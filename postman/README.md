# Thai Please Postman

ไฟล์ในโฟลเดอร์นี้สร้างจาก Controller และ DTO ที่มีอยู่จริงใน `apps/api` เท่านั้น

## วิธีใช้งาน

1. เปิด API ที่ `http://localhost:4000` โดยใช้ prefix `api/v1`
2. Import `Thai-Please.postman_collection.json`
3. Import `Local.postman_environment.json` และเลือก environment `Thai Please - Local`
4. กรอก Citizen ID และรหัสผ่านของบัญชีทดสอบที่ได้รับอนุญาตใน Current Value ของ environment ห้ามใช้ข้อมูลจริงในไฟล์ที่ commit
5. เรียก Login ของ role ที่ต้องการก่อนเรียก endpoint ที่มีการป้องกัน

## Authentication และ Cookie Jar

API ไม่คืน access token ใน response body แต่ส่ง `access_token` เป็น HttpOnly cookie ผ่าน `Set-Cookie` Postman จะเก็บ cookie ใน Cookie Jar ของ `localhost` และส่งให้คำขอถัดไปอัตโนมัติ จึงไม่ต้องสร้าง Bearer token หรือคัดลอก secret ลง environment

Cookie Jar หนึ่งชุดถือ session ที่ login ล่าสุดเท่านั้น การสลับ workflow ระหว่าง Merchant และ Consumer ให้ทำตามลำดับนี้:

1. Login Merchant แล้วสร้าง Category/Product/Order ตามสิทธิ์
2. ค่า `productId` และ `qrToken` จะถูกเก็บใน environment โดย test script
3. Login Consumer ซึ่งจะแทนที่ cookie เดิม
4. เรียก Preview และ Pay ด้วย `qrToken` ที่เก็บไว้
5. Login Admin ก่อนเรียก Users หรือ Create Category ที่จำกัดสิทธิ์ Admin

Logout จะ revoke session ปัจจุบันและลบ cookie

## ข้อมูลทดสอบและตัวแปร

- ค่า credential ใน environment ถูกเว้นว่างและกำหนดชนิดเป็น secret
- Registration bodies เป็นโครงตาม DTO และใช้ข้อมูลตัวอย่างที่ไม่ใช่บุคคลจริง แต่ต้องแทน `citizenId`, เบอร์โทร และข้อมูลอื่นตามระบบตรวจสอบที่ใช้งานอยู่
- `idempotencyKey` ของ Top-up ต้องยาว 8–128 ตัวอักษร และจะถูกสร้างให้อัตโนมัติเมื่อยังไม่มีค่า
- FR-C02 ใช้จำนวนเต็มหน่วยบาท ขั้นต่ำ 1 บาท และสูงสุด 50,000 บาทต่อรายการ
- FR-C03 ใช้ `Get Daily Subsidy Status` ซึ่งคืน `THB`, `Asia/Bangkok`, เวลา `asOf`, ยอดคงเหลือ, วงเงิน, ยอดใช้ และวงเงินคงเหลือเป็นจำนวนเงินทศนิยมไม่เกิน 2 ตำแหน่ง หากไม่มีโครงการที่ active จะได้ `program: null` และวงเงินรายวันเป็นศูนย์
- `dailySubsidyRemaining` คำนวณจาก `max(0, dailySubsidyLimit - dailySubsidyUsed)` โดยไม่ clamp กับยอด `subsidyBalance`
- การทดสอบ Idempotency ให้เรียก `Top Up Personal Wallet` ก่อน แล้วเรียก `Replay Personal Top-up (Same Key and Amount)` โดยไม่เปลี่ยน key; ต้องได้ transaction เดิมและ `isIdempotentReplay=true`
- `Reject Reused Key with Different Amount` ต้องได้ 409 เพราะ key เดิมห้ามใช้กับจำนวนเงินใหม่ เมื่อต้องการเริ่มรายการใหม่ให้ล้างค่า `idempotencyKey` ใน environment ก่อน
- `Get Wallet Transactions` คืนข้อมูลครั้งละ 20 รายการ หากต้องการกรองวันที่ให้กรอก `walletDateFrom`/`walletDateTo` รูปแบบ `YYYY-MM-DD` แล้วเปิด query parameters ทั้งสอง ค่าเป็นวันตาม `Asia/Bangkok` และรวมทั้งวันเริ่มต้น/สิ้นสุด
- เมื่อ response มี `nextCursor` test script จะเก็บลง `walletTransactionCursor`; เปิด query parameter `cursor` แล้วส่งซ้ำเพื่อโหลดหน้าถัดไป
- ฟิลด์ optional เช่น `userCouponId` ไม่ถูกส่งใน body เริ่มต้น หากต้องการทดสอบคูปองให้เพิ่มฟิลด์ด้วยค่าที่เป็นเจ้าของ Consumer คนนั้น

## กลุ่มและสิทธิ์

- Health: Public
- Auth: Register/Login เป็น Public; Logout ต้อง login
- Users: `/users/me` ใช้ทุก role; endpoint อื่นใช้ Admin
- Consumer Wallet: Consumer
- Catalog: อ่าน category ใช้ Consumer/Merchant/Admin; สร้าง category ใช้ Admin; product ใช้ Merchant
- Merchant Orders: Merchant
- Consumer Payment: Consumer

Expected status ระบุใน description และมี test ตรวจ status ของแต่ละ request หาก API ตอบ 401/403 ให้ตรวจ Cookie Jar และ role ของ session ล่าสุดก่อน
