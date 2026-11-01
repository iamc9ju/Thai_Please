# นโยบายเควส v2 (ประวัติการออกแบบ)

> v3 แทนที่เอกสารนี้ในการเปลี่ยนวันที่ 28 ตุลาคม 2026 ใช้ [คู่มือเควส v3](QUEST_PROPOSALS_RUNBOOK_TH.md) สำหรับกฎและการปฏิบัติงาน เนื้อหาด้านล่างอ้างอิง v2 เท่านั้น

ไฟล์ค่ากลาง: `apps/api/src/quests/config/quest-policy.json` ตรวจด้วย `parseQuestPolicy` ใน domain. เริ่มจาก config/validator/tests; ปัจจุบันมี Backend generation ที่ใช้ policy นี้แล้ว ดู [คู่มือ Backend](QUEST_BACKEND_TH.md). มี completion/ออกแต้มหลัง PAID แล้ว แต่ยังไม่เปิด schedule

## กฎจาก requirements

- FR-C07 / FR-S05: มอบอัตโนมัติ ไม่ต้องกดรับ แสดงเงื่อนไข รางวัล สถานะ และ expiry
- FR-S01: วิเคราะห์ Paid Orders, items, categories, final spend, frequency และ quest history
- FR-S02/03: AI เสนอเท่านั้น ต้องตรวจ schema/allow-list/spend/reward/expiry/duplicate/budget/policy
- FR-S04: ต้องบันทึก provider/model/prompt/policy versions และผล validation ใน integration ภายหลัง
- FR-S06: หนึ่ง PAID Order หลังส่วนลด ใช้ snapshot category แจกครั้งเดียว
- BR-POINT-01/02: ledger และ balance atomic แต้มมี expiry; NFR-TIME-01 expiry exclusive และ UTC

AGENTS ที่ส่งในแชตมีช่วงเลข FR ต่างจาก REQUIREMENTS: เอกสารนี้อ้าง ID ปัจจุบันตามชื่อ capability ไม่แก้เลขย้อนหลังโดยอัตโนมัติ

## ค่าเริ่มต้นที่ agent เลือกตามอำนาจที่ผู้ใช้ให้

| หมวด             | ค่าและเหตุผล                                                                                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ประวัติ          | rolling 30 วัน พร้อม count 7 วัน ใช้ช่วง `[asOf-duration, asOf)` เฉพาะ PAID ของเจ้าของ; quest history อ่านอดีตทั้งหมดสำหรับ active/dedup/cooldown                                                                                                                       |
| ประวัติขั้นต่ำ   | 3 บิลรวม; target ต้องเคยซื้ออย่างน้อย 2 บิล ถ้าไม่พอข้ามประเภทนั้น ถ้าไม่เหลือตัวเลือกเลื่อน ไม่สร้างประวัติสมมติ                                                                                                                                                       |
| ประเภท           | MIN_SPEND และ CATEGORY_SPEND เท่านั้น; ซื้อจากร้านที่เข้าร่วมใดก็ได้ ไม่ผูกชื่อ/ID สินค้าหรือร้าน                                                                                                                                                                       |
| เป้ายอด          | 1 เท่า/1.5 เท่าของค่าเฉลี่ย เก็บตัวคูณเป็น numerator/denominator ใช้ integer/Decimal และ ceil หน่วยสตางค์; ถ้าหลุดช่วง 10–1,000 บาทให้ตัด candidate ไม่ clamp                                                                                                           |
| ฐานค่าเฉลี่ย     | ทั้งบิลสำหรับ MIN_SPEND; ยอดหมวดหลังแบ่งส่วนลดเฉพาะบิลที่มีหมวดนั้นสำหรับ CATEGORY_SPEND                                                                                                                                                                                |
| ส่วนลดหมวด       | ข้อกำหนดกำหนด after-discount แต่สูตร allocation ยังไม่ระบุใน REQUIREMENTS ปัจจุบัน: เลือกแบ่งตามสัดส่วน line_total ใช้ largest remainder หน่วยสตางค์ tie ด้วย order_item_id; ไม่หัก subsidy ซ้ำ ผลรวมต้องตรง final_amount                                               |
| เป้าหมาย         | เฉพาะหมวดที่เคยซื้อและยังมีสินค้าใช้งานได้จากร้าน active (MIN_SPEND ไม่มี target); จัดลำดับจำนวนบิลมากก่อน ซื้อครั้งล่าสุดก่อน แล้ว ID น้อยก่อน ใช้ ID numeric เปรียบเทียบแบบไม่เสีย precision                                                                          |
| จำนวนตัวเลือก    | ไม่เกิน 4 ต่อประเภท รวม 8; กำจัดตัวเลือกเงื่อนไขซ้ำก่อนตัดจำนวน ลำดับตัวคูณตาม JSON                                                                                                                                                                                     |
| คะแนน            | integer 0–100 เพื่อจัดอันดับความสอดคล้องและความท้าทาย ไม่ใช่ probability; ทุก candidate ต้องมีคะแนนครั้งเดียว ไม่มีเกณฑ์ขั้นต่ำใน v1                                                                                                                                    |
| คะแนนเท่ากัน     | เป้ายอดต่ำกว่าก่อน แล้ว candidate ID แบบ canonical ASCII ascending; ID ต้องสร้าง deterministic                                                                                                                                                                          |
| รอบมอบ           | ทุกวัน 08:00 Asia/Bangkok; เก็บ UTC สูงสุด 1 active และ 1 assignment ต่อ user ต่อวันปฏิทิน Bangkok; ทำสำเร็จแล้วรอรอบถัดไป ไม่มี refill ทันที                                                                                                                           |
| ซ้ำ              | เควส type+target เหมือน active ถือว่าซ้ำแม้ยอดต่างกัน; MIN_SPEND ไม่มี target จึงซ้ำกันทุก threshold; หลัง completion/expiry เว้น 7×24 ชั่วโมงโดยอิง finalized time ไม่ใช้ current state ย้อนเดา                                                                        |
| อายุเควส         | 7×24 ชั่วโมงจาก assignment; paidAt >= assignedAt และ paidAt < expiresAt                                                                                                                                                                                                 |
| แต้ม             | ทุกประเภท 20 แต้ม อายุ 90×24 ชั่วโมงจาก issuance; Backend เป็นผู้กำหนด ไม่ให้ AI เปลี่ยน                                                                                                                                                                                |
| งบ               | จอง ณ assignment สูงสุด 2,000 แต้มต่อวัน Bangkok รวมทั้งระบบ; outstanding reservations สูงสุด 14,000; จองรายวันนับสะสมการมอบวันนั้น ไม่คืนโควตาวันนั้นเมื่อ complete/expire; outstanding ปลดเมื่อ reward issuance หรือ expire; แต้มที่ออกแล้วไม่หายเมื่อปลด reservation |
| หนึ่งบิลหลายเควส | ไม่เกิน 1 assignment; แม้เพิ่ม active limit ภายหลัง limit นี้ยังคง 1 เว้นแต่แก้ policy โดยตั้งใจ; หากมีหลายข้อเข้าเงื่อนไขเลือก assignedAt เก่าสุดแล้ว assignment ID น้อยสุด                                                                                            |
| API ล้มเหลว      | สูงสุด 2 attempts ต่อ generation เฉพาะ retry-safe failures พร้อม backoff/timeout จาก environment; invalid response ไม่ retry; ถ้ายังล้มเหลวให้ log และเลื่อน ไม่มี fake AI result ไม่มีแต้ม                                                                             |

สูตรหมวดเฉพาะหมวดต่างจาก CatBoost offline experiment เดิมที่ใช้ average ทั้งบิล เอกสารและชุดข้อมูล CatBoost เป็นคนละเวอร์ชันและไม่ถูกแก้ย้อนหลัง การเปลี่ยนนี้เป็น policy ของ flow Gemini ที่ผู้ใช้อนุญาตให้กำหนดค่าเริ่มต้น ไม่ได้อ้างว่ามีผลประเมินดีกว่าเดิม

## การแก้และข้อจำกัด

แก้ JSON และเพิ่ม version เมื่อเปลี่ยนความหมาย จากนั้นต้อง validate และรัน tests ก่อนใช้ ระบบอนาคตต้องบันทึก policy snapshot/versions และเงื่อนไขบน assignment; เควสที่มอบแล้วไม่เปลี่ยนย้อนหลัง อายุแต้มใช้ snapshot ตอน issuance

ค่าชนิด literal แสดงกลยุทธ์ที่รองรับปัจจุบัน การเพิ่มกลยุทธ์ใหม่ต้องแก้ schema, implementation และ tests ด้วย ไม่ใช่แค่เปลี่ยน string. เกณฑ์คะแนนใน policy ต้องแปลงเป็น versioned prompt ภายหลัง

config ไม่ได้บังคับ runtime เอง: budget/active limit/idempotency ต้องมี transaction และ constraints การจองงบยังไม่มีตารางหรือ implementation; clock/job, adapter และ assignment ยังไม่มี; JSON ต้องถูกโหลดและตรวจใน startup ก่อนนำไปใช้จริง deployment ต้องบรรจุ config ชัดเจนภายหลัง. API model/key/timeout ไม่อยู่ในไฟล์นี้ ใช้ validated server environment และ Docker secrets

ขั้นสรุปประวัติ/candidate ต่อไปต้องเพิ่ม PostgreSQL integration tests สำหรับ boundaries/ownership/discount snapshots และ unit tests สำหรับสูตร/การกรอง. ห้ามถือ tests ของ policy ว่า FR-C07 หรือ reward flow เสร็จแล้ว

## การเปลี่ยนจาก v1 (27 ตุลาคม 2026)

ตามคำสั่งผู้ใช้ ยกเลิกการสร้าง PRODUCT_PURCHASE และ MERCHANT_SPEND ทั้งหมด ไม่เพิ่มคำค้นชื่อสินค้า. Policy v2 ส่ง Gemini เฉพาะยอดรวมและสถิติหมวดที่เกี่ยวข้อง. ระบบปฏิเสธ candidate ที่เลิกใช้ใน provider และ finalize แม้เป็นงาน v1 ที่ค้างอยู่. Migration เพิ่ม cancelled_at/cancellation_reason บน user_quests และยกเลิกเฉพาะ ACTIVE ที่ยังไม่หมดอายุของสองประเภทที่เลิกใช้; ประวัติ COMPLETED/EXPIRED และแต้มเดิมไม่เปลี่ยน. ข้อมูลคำสั่งซื้อและคอลัมน์เป้าหมายสินค้า/ร้านยังเก็บไว้เพื่อ audit; ไม่ใช้สร้างเงื่อนไขใหม่. ต้องหยุด worker เก่าแล้ว apply migration ก่อน restart ด้วย v2.
