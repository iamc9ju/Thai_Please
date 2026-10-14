# แผนเริ่มระบบ AI Personalized Quest Recommendation สำหรับผู้เริ่มต้น

สถานะ: ขั้น 1 พร้อม; ขั้น 2–3 ปรับเป็น Complete Journey pilot แล้ว (1,664 samples, 8 features); ขั้น 4–9 ยังไม่เริ่ม วันนี้หยุดก่อนฝึก

วันที่ปรับล่าสุด: 15 ตุลาคม 2026

เอกสารต้นทาง: `AI_IMPLEMENTATION_PLAN.md` ครบ 17 หัวข้อ และรหัสจาก `docs/REQUIREMENTS.md`

เอกสารนี้เป็นแผนลำดับงานประกอบ [แผน AI หลัก](../AI_IMPLEMENTATION_PLAN.md) และ [แผน AI ภาษาไทย](../AI_IMPLEMENTATION_PLAN_THAI.md) โดยขยายขั้นติดตั้งและวิธีทำงานสำหรับผู้เริ่มต้น ไม่เปลี่ยนขอบเขต 5 phases ของแผนหลัก

### สถานะความคืบหน้า

| ขั้น | งาน                             | สถานะ                                                    |
| ---- | ------------------------------- | -------------------------------------------------------- |
| 0    | เข้าใจขอบเขตและปิดข้อกำหนด      | ยืนยัน Order เดียวแล้ว; policy ที่เหลือยังรอตัดสินใจ     |
| 1    | เตรียมเครื่องมือและ environment | เสร็จแล้วตามผลตรวจที่ผู้ใช้ส่งมา                         |
| 2    | ออกแบบข้อมูลและ features        | v2 เสร็จ: 8 features, proxy label, relative policy       |
| 3    | เตรียมข้อมูลฝึก                 | pilot 1,664 แถว (163/1,501); tests ทั้งชุดผ่าน 50 รายการ |
| 4    | ฝึกโมเดล                        | ยังไม่เริ่ม — วันนี้ไม่ทำขั้นนี้                         |
| 5    | ประเมินโมเดล                    | ยังไม่เริ่ม                                              |
| 6    | สร้าง FastAPI                   | ยังไม่เริ่ม                                              |
| 7    | เชื่อม NestJS                   | ยังไม่เริ่ม                                              |
| 8    | Completion และ points           | ยังไม่เริ่ม                                              |
| 9    | ทดสอบทั้งระบบและคู่มือ          | ยังไม่เริ่ม                                              |

หลักฐานขั้นที่ 1: ผู้ใช้สร้าง `ai-service/.venv` ด้วย Python 3.14.3 ติดตั้ง libraries สำเร็จ รัน `pip check` ได้ `No broken requirements found`, import libraries ได้ `AI libraries OK` และบันทึก `pip freeze` เป็น `ai-service/requirements.txt` แล้ว ผู้ช่วยตรวจพบไฟล์ requirements ใน Repository ด้วย

การตรวจนี้ยืนยันความพร้อม environment ปัจจุบัน ยังไม่ใช่ผลทดสอบ training/API หรือการติดตั้งซ้ำใน environment ใหม่

## 1. เรากำลังสร้างอะไร

AI ในงานนี้เป็น CatBoost ที่เรียนรู้จากข้อมูลแบบตารางเพื่อให้คะแนนว่า “มีแนวโน้มเกิดการซื้อที่ตรงเงื่อนไขของตัวเลือกนี้ในหนึ่งบิลหรือไม่” ไม่ใช่ ChatGPT และไม่สร้างข้อความเควสเอง Source ไม่มี actual quest outcomes จึงไม่อ้างโอกาสสำเร็จหลังได้รับเควสจริง

ตัวอย่างสมมติ: ผู้ใช้ซื้อเฉลี่ย 100 หน่วยเงิน ระบบทดลองตัวเลือกเป้า 1.0 และ 1.5 เท่าของ average แล้วคืน purchase-match scores; NestJS เลือกตาม policy ไม่จำเป็นต้องเลือกคะแนนสูงสุด

NestJS สร้างตัวเลือกจากแม่แบบ คำนวณ features เรียก AI ตรวจผล เลือก มอบหมาย และบันทึก log ส่วนการตรวจสำเร็จและออกแต้มเป็นกฎ deterministic ใน NestJS เท่านั้น

**ยืนยันโดยผู้ใช้: เควสต์ต้องสำเร็จใน Paid Order เดียว ห้ามสะสมหลาย Order ใช้ยอดหลังส่วนลด เงินอุดหนุนไม่ใช่ส่วนลด และให้แต้มครั้งเดียว**

## 2. คำที่ต้องรู้ก่อนเริ่ม

| คำ                     | ความหมายในโปรเจกต์                                                        |
| ---------------------- | ------------------------------------------------------------------------- |
| Dataset                | ตารางตัวอย่างฝึก หนึ่งแถวต่อผู้ซื้อ + cutoff + candidate ใน v2            |
| Feature                | ข้อมูลที่โมเดลใช้ เช่น จำนวนซื้อใน 30 วัน ยอดเฉลี่ย ประเภทเควสต์          |
| Label                  | v2 พบหนึ่งบิลตรงเงื่อนไข = 1; ไม่พบและช่วงครบ = 0; ช่วงไม่ครบไม่ให้ label |
| Training               | ให้โมเดลเรียนรูปแบบจากตัวอย่างที่ทราบคำตอบแล้ว                            |
| Prediction / inference | ใช้โมเดลที่ฝึกแล้วให้คะแนนข้อมูลใหม่                                      |
| Model artifact         | ไฟล์โมเดลที่ฝึกแล้ว เช่น `.cbm`                                           |
| API                    | ช่องทางให้ NestJS ส่งข้อมูลไปหา Python และรับผลกลับ                       |
| Synthetic data         | ข้อมูลจำลองสำหรับทดสอบต้นแบบ ไม่ใช่พฤติกรรมจริง                           |
| Data leakage           | ใช้ข้อมูลอนาคตที่ยังไม่มีตอนมอบหมาย ทำให้ผลทดสอบดูดีเกินจริง              |
| Virtual environment    | โฟลเดอร์ Python และ dependencies แยกสำหรับงานนี้                          |

## 3. จุดเริ่มต้นที่ตรวจพบ

- มี React/Vite, NestJS, PostgreSQL/Prisma และ pnpm workspace แล้ว
- ก่อนเริ่มขั้นที่ 1 ยังไม่มี AI service; ปัจจุบันมี environment, legacy synthetic fixtures และ Complete Journey pilot แล้ว แต่ยังไม่มี training scripts หรือ model artifact
- ตรวจฐานข้อมูลแบบอ่านอย่างเดียวในรอบวิเคราะห์ก่อนหน้า: Paid Orders 0, quests 1, assignments 1 สถานะ ACTIVE, recommendation logs 0
- จึงยังไม่มี finalized labels สำหรับฝึกจากข้อมูลจริง และห้ามนับ ACTIVE เป็น failure
- Schema และฐานข้อมูลมี `prediction_score`, `candidate_scores`, `selection_reason` แล้ว ไม่ต้องเพิ่มซ้ำ
- ยังขาด recommendation workflow, deterministic completion/reward/expiry workflow และการป้องกัน reward ซ้ำระดับฐานข้อมูล
- เครื่องนี้ใช้ Python 3.14.3 และติดตั้ง dependencies พร้อมผ่าน pip check/import checks แล้วตามหลักฐานผู้ใช้

ตัวเลขข้างต้นเป็นสถานะขณะตรวจ ไม่ใช่การรับรองว่าฐานข้อมูลจะไม่เปลี่ยนภายหลัง

## 4. ขั้น 0 — เข้าใจภาพรวมและปิดข้อกำหนด

ก่อนติดตั้งหรือเขียนโค้ด ต้องแยกงานสองช่วง:

1. ต้นแบบ AI แบบอิสระ: ข้อมูลจำลอง → ฝึก CatBoost → ประเมิน → Prediction API
2. ระบบเต็ม: NestJS → Features/Candidates → AI → Assignment/Log → Paid Order → Completion/Points

ส่วนแรกช่วยเรียนรู้และทดสอบ pipeline ได้ แต่ยังไม่ใช่ระบบแนะนำที่พิสูจน์กับผู้ใช้จริง

สิ่งที่ต้องตกลงก่อนส่วนที่เกี่ยวข้องเริ่ม:

- อนุมัติ synthetic dataset สำหรับต้นแบบหรือรอข้อมูลจริง
- เวลา/ผู้มีสิทธิ์ trigger recommendation จำนวน active quests และวิธีกันซ้ำ
- selection policy: ช่วง spend, reward, duration, budget และเกณฑ์เลือก ไม่มีตัวเลขธุรกิจที่กำหนดเอง
- AI ไม่พร้อม: ไม่มอบหมาย หรือ fallback แม่แบบที่ผ่าน policy
- การที่ Order เดียวทำหลาย assignments สำเร็จ (การแบ่งส่วนลด category ยืนยันแล้วตาม BR-QUEST-PRICING-01)
- อายุแต้มและการประมวลผลล่าช้า; expiry boundary ยึด NFR-TIME-01 และใช้ paidAt ตรวจ completion
- ความหมายของ generation/proposal/prompt fields ใน REQUIREMENTS เมื่อใช้ CatBoost scoring

## 5. ขั้น 1 — ติดตั้งเครื่องมือและ environment

### ติดตั้งอะไรและทำไม

| เครื่องมือ                   | ใช้ทำอะไร                                    |
| ---------------------------- | -------------------------------------------- |
| Python แบบ 64-bit            | รันโปรแกรม AI                                |
| pip                          | ติดตั้ง Python libraries                     |
| venv                         | แยก libraries ออกจาก Python ส่วนอื่น         |
| CatBoost                     | ฝึกและทำนาย binary classification            |
| Pandas / NumPy               | อ่านและจัดข้อมูลตาราง                        |
| scikit-learn                 | split ข้อมูล สร้าง baseline และคำนวณ metrics |
| FastAPI / Pydantic / Uvicorn | รับ request ตรวจ schema และรัน AI API        |
| pytest / httpx               | ทดสอบ pipeline และ API                       |

เริ่มด้วย CPU ได้ ไม่กำหนดให้ซื้อ GPU ไม่ต้องใช้ OpenAI API key สำหรับ CatBoost นี้

ใช้ Python 3.14.3 แบบ 64-bit ที่มีอยู่: ผล dry-run พบ binary wheels และผู้ใช้ติดตั้งพร้อมตรวจ imports สำเร็จแล้ว จึงไม่ต้องติดตั้ง Python 3.12 เพิ่ม

คำสั่งตรวจรุ่นที่ใช้:

```powershell
py -0p
py -3.14 --version
py -3.14 -m pip --version
```

คำสั่งสร้าง environment ที่ผู้ใช้ทำเสร็จแล้ว เก็บไว้เป็นข้อมูลอ้างอิง ไม่ต้องสร้างทับ environment ปัจจุบัน:

```powershell
Set-Location 'C:\Users\koath\Desktop\web-app-project\Thai_Please'
New-Item -ItemType Directory -Path '.\ai-service' -Force
py -3.14 -m venv .\ai-service\.venv
Set-Location .\ai-service
```

เรียก Python ด้วย path ของ venv โดยตรง จึงไม่จำเป็นต้องเปลี่ยน PowerShell execution policy เพื่อ activate

ผู้ใช้บันทึกเวอร์ชันด้วย pip freeze ไว้ใน `requirements.txt` แล้ว คำสั่งติดตั้งซ้ำและตรวจ environment:

```powershell
.\.venv\Scripts\python.exe -m pip install --only-binary=:all: -r requirements.txt
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -c "import catboost, pandas, numpy, sklearn, fastapi, pydantic, uvicorn, pytest, httpx; print('AI libraries OK')"
```

ถ้าไม่มี wheel ที่ตรงกัน ให้แก้ Python/package compatibility อย่างชัดเจน ไม่เริ่ม compile dependencies เองโดยไม่เข้าใจสาเหตุ และไม่ใช้คำสั่งติดตั้งเป็นหลักฐานว่า pipeline ทำงานแล้ว

**ผลขั้นนี้:** imports และ pip check ผ่าน พร้อมมี pinned requirements แล้ว การทดสอบติดตั้งซ้ำใน environment ใหม่ยังไม่ได้รัน

**ไฟล์ที่จะสร้าง/แก้:** `ai-service/requirements.txt`, `ai-service/README.md`, `.gitignore` สำหรับ venv/cache/private datasets; ไม่แก้ pnpm lockfile เพราะ Python แยก environment

## 6. ขั้น 2 — ออกแบบตารางข้อมูลและ features (v2 ปัจจุบัน)

ผู้ใช้อนุมัติ Complete Journey, relative targets และ department หมวดกว้างแล้ว Contract ที่ใช้ต่ออยู่ [COMPLETE_JOURNEY_PREPARATION.md](ai/COMPLETE_JOURNEY_PREPARATION.md) มี 8 features และ label การซื้อที่ตรงเงื่อนไขในหนึ่งบิล นโยบายกลางอยู่ `ai-service/config/quest_template_policy_v2.json` (offline experiment; NestJS adapter ยังไม่ทำ)

ใช้ 1.0/1.5 × average ทั้งบิล 30 วัน, duration 7 วัน Target IDs/ยอดเงินจริง/proof อยู่ metadata ไม่ใช่ predictors ไม่มี quest-history/reward effects ให้โมเดลเรียน Source dollars ไม่แปลงเป็นบาท; ratio ลดปัญหาหน่วยแต่ต้องตรวจ domain ก่อนใช้จริง

### หลักฐาน legacy synthetic-v1 ที่เก็บไว้

**เสร็จเฉพาะงานเอกสาร:** [DATASET_SCHEMA.md](ai/DATASET_SCHEMA.md) และ [FEATURE_DEFINITIONS.md](ai/FEATURE_DEFINITIONS.md) ตรวจเทียบกับ Prisma แล้ว ไม่มีการแก้ schema หรือเขียน Python

ผู้ใช้ยืนยันให้ใช้ข้อมูลจำลองทั้งหมดสำหรับโปรเจกต์ส่งอาจารย์ และข้อมูลต้นทางชุดเดียวสำหรับเทรนกับสาธิตใน development DB ตัวนับซื้อใช้ 7/30 วันคนละคอลัมน์ ประวัติซื้อเป้าหมายใช้ 30 วัน ประวัติเควสต์ใช้ทั้งหมดก่อน cutoff

สูตร missing values เป็น convention ทางเทคนิคใน feature v1; discount allocation ยืนยันตาม BR-QUEST-PRICING-01 และ expiry boundary ยึด NFR-TIME-01 แล้ว ขณะจบขั้น 2 มีเฉพาะเอกสาร; ขั้น 3 implement offline pipeline และ tests แล้วตามสถานะด้านบน

ต้องทำก่อน train เพื่อให้รู้ว่าโมเดลกำลังเรียนรู้อะไร

หนึ่งแถวแทน assignment ในอดีต ประกอบด้วย features ที่มีตอนมอบหมาย และ label ที่ทราบเมื่อผล finalized แล้ว

ตัวอย่างคอลัมน์เริ่มต้น: assigned_at, purchases_7d, purchases_30d, avg_order_value_30d, total_spend_30d, historical completion rate, quest_type, min_spend, reward_point, duration_days และ completed

เพิ่ม features ตามแผนเดิมสำหรับ target category/merchant/product โดยมีสูตรชัดเจน ไม่ใช่เพิ่มตามอำเภอใจ สูตรเช่น average ต้องระบุว่าจะใช้ finalAmount, cutoff เวลาใด และเมื่อไม่มีประวัติจะส่งค่าอะไร

Identifiers เป็นข้อมูลติดตามหรือ grouping ไม่ใช้ citizen ID, ชื่อ, โทรศัพท์ หรือ user ID เป็น predictive feature โดยไม่มีเหตุผลที่อนุมัติ

ประวัติ completion ต้องนับเฉพาะผลที่ทราบก่อน assignment นั้น ไม่อ่านสถานะสุดท้ายวันนี้ไปใส่เป็นประวัติของอดีต

กำหนด units ของเงินและ encoding ให้ตรงกันระหว่าง NestJS/Python การคำนวณเงินธุรกิจยังใช้ exact arithmetic; probability/metrics เป็นค่าทางสถิติ ไม่ใช่ยอดเงินที่อนุมัติจ่าย

**ผ่านเมื่อ:** มี feature schema ระบุ type, units, สูตร, cutoff, missing values และการทดสอบป้องกัน leakage

**ไฟล์:** `docs/ai/DATASET_SCHEMA.md`, `docs/ai/FEATURE_DEFINITIONS.md`, `ai-service/src/features.py`, `ai-service/tests/test_features.py`

## 7. ขั้น 3 — เตรียมข้อมูลฝึก (v2 ปัจจุบัน)

[prepare_complete_journey.py](../ai-service/prepare_complete_journey.py) อ่าน source เต็มที่ audit แล้ว สุ่ม 200 households จากประวัติก่อน cutoff แรก 4 cutoffs × 4 candidates สูงสุด 3,200 ก่อนกรอง ได้ **1,664 samples (label 1 = 163, label 0 = 1,501)** ครบ 4 ประเภทและทั้งสอง labels ในแต่ละประเภท เก็บใน [manifest ใหม่](../ai-service/data/complete_journey_pilot/manifest.json)

Source quantity/category/department/total ผิดเงื่อนไข → reject ทั้ง basket และ censor หน้าต่างที่ได้รับผล ไม่สร้าง label 0 จากข้อมูลที่ไม่ครบ ภายหลังประเมิน coverage และ product positives ที่น้อยก่อนขยายประมาณ 80,000 possible samples

ไฟล์ใหม่: CSV, feature schema, template policy, preview 8 samples, exclusion reasons และ provenance manifest ไม่ทำ DB import/migration/seed/model/API วันนี้

### หลักฐาน legacy synthetic-v1 ที่เก็บไว้

**เสร็จแล้วสำหรับ offline:** [prepare_data.py](../ai-service/prepare_data.py), [คู่มือรัน](../ai-service/README.md), [training CSV](../ai-service/data/training_data.csv) และ [manifest](../ai-service/data/manifest.json)

ชุด demo: 60 users, 2,228 Paid Orders, 540 assignments; CSV 496 แถว (สำเร็จ 171, หมดอายุ 325), ACTIVE 44 ไม่นำไป label 0 ครบ 4 quest types มี cutoff snapshots, seed/versions/hashes และตรวจสร้างซ้ำได้ผลเดิม Tests ผ่าน 25 รายการ รวม leakage, validity, rounding, snapshots และ invalid raw data

ยังไม่ได้ seed Database, ทดสอบ offline/DB parity, train หรือเปิด API และยังไม่ใช่ production completion engine

ผู้ใช้อนุมัติแนวทาง synthetic data สำหรับโปรเจกต์ส่งอาจารย์แล้ว: สร้างประวัติจำนวนซื้อ/assignment/ผลตามกฎต้นทางชุดเดียวภายนอก DB แล้ว derive CSV และใช้ seed development DB ในขั้นหลัง โดยครอบคลุม quest types ทั้ง 4, ผู้ใช้ไม่มีประวัติ, missing targets ตามชนิด, success และ expired failure; ไม่สุ่ม labels ที่ขัดกับ Order history

ข้อมูลจำลองใช้เรียนรู้ pipeline เท่านั้น ต้องมี provenance, seed และคำอธิบายสมมติฐาน ผล metrics ต้องติดป้าย synthetic ไม่อ้างความแม่นยำจริง

ขอบเขต legacy นี้ใช้ข้อมูลจำลองตาม synthetic-v1; generator และ tests ทำแล้ว แยกจาก external-purchase pipeline v2 ข้อมูล ACTIVE/PENDING ไม่เป็น failure; actual completion ภายหลังยังยึด REQUIREMENTS

**ผ่านเมื่อ:** dataset validation ผ่าน มีทั้งสอง labels และไม่มี features จากอนาคต/PII

**ไฟล์:** `ai-service/prepare_data.py`, `ai-service/data/training_data.csv` (synthetic), `ai-service/tests/test_dataset.py`

## 8. ขั้น 4 — ฝึกโมเดลและบันทึก artifact

เรียงงาน: อ่าน dataset → ตรวจ schema → แยก categorical/numerical → แบ่ง train/validation/test ตามเวลา → ฝึก baseline → ฝึก CatBoost → save model และ metadata

ยังไม่ทำวันนี้ v2 ต้องใช้ ordered 8 features กับ purchase-match label ไม่ป้อน metadata และไม่สวมชื่อ actual completion เก็บ same-cutoff candidates ในกลุ่มเดียวกันและ purge train outcome windows ที่ทับ cutoff ของ validation/test ไม่ random split แถวที่ใช้ประวัติร่วมกัน

Training ใช้ข้อมูลฝึก ส่วน validation ใช้ตัดสินใจปรับโมเดล และ test เก็บไว้ตรวจสุดท้าย ไม่ปรับโมเดลจาก test ไปเรื่อย ๆ

กำหนด random seed และเก็บ dataset version, feature version, package versions, model configuration และ training timestamp เพื่อทำซ้ำได้

คำสั่งตัวอย่างที่จะใช้หลังมี scripts แล้ว ไม่ใช่คำสั่งที่รันได้ใน repository ตอนนี้:

```powershell
.\.venv\Scripts\python.exe train.py
```

**ผ่านเมื่อ:** มี model artifact versioned, schema/metadata คู่กัน และทดสอบโหลดกลับมาทำนายได้

**ไฟล์:** `ai-service/train.py`, `ai-service/models/<model-version>/quest_model.cbm`, `ai-service/models/<model-version>/feature_schema.json`, `ai-service/models/<model-version>/metadata.json`, `ai-service/tests/test_training.py`

## 9. ขั้น 5 — ประเมินผลก่อนเปิด API

ไม่ถือว่าฝึกสำเร็จเพียงเพราะไม่มี error ต้องเทียบ baseline และดู ROC-AUC, Precision, Recall, F1, Log Loss และ Brier/calibration ตามแผน

สำหรับระบบนี้ calibration สำคัญ เพราะ score ถูกใช้เลือก quest: คะแนน 0.8 ควรมีความหมายใกล้โอกาสสำเร็จ 80% เมื่อทดสอบกับข้อมูลจริงที่เหมาะสม

แยกผลตาม quest type และ cold-start; ถ้าข้อมูล split มี label เดียว บาง metrics คำนวณไม่ได้ ต้องรายงานข้อจำกัด ไม่แต่งผลขึ้นมา

ยังไม่มี approved pass/fail thresholds ต้องตกลงก่อนอ้างว่าโมเดลพร้อมจริง Synthetic metrics ไม่พิสูจน์ engagement/spending uplift

```powershell
.\.venv\Scripts\python.exe evaluate.py
```

**ผ่านเมื่อ:** มีรายงาน dataset provenance, split, baseline, metrics, limitations และเกณฑ์ที่อนุมัติ

**ไฟล์:** `ai-service/evaluate.py`, `ai-service/reports/<model-version>/evaluation.json`, `ai-service/tests/test_evaluation.py`

## 10. ขั้น 6 — สร้าง FastAPI สำหรับโมเดล

โหลด model/schema/version ตอนเริ่ม service แล้วเปิด `POST /predict-quests` รับ features และ candidate list ส่งกลับคะแนนตรง IDs และ model version

Pydantic ตรวจชนิดข้อมูล missing/unknown fields และ domain constraints; NestJS ต้องตรวจ response อีกครั้ง รวมถึงคะแนน finite ในช่วง 0–1, IDs ไม่ซ้ำและไม่หาย

ถ้า artifact หาย/schema ไม่ตรง ให้แสดง failure ที่ชัดเจน ไม่คืนคะแนนปลอม ต้องกำหนด batch limit, I/O timeout และขอบเขตสิทธิ์เข้าถึงก่อน deployment

ตัวอย่างรันเฉพาะเครื่องพัฒนาหลังมี main.py แล้ว:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
.\.venv\Scripts\python.exe -m pytest
```

เปิด `http://127.0.0.1:8000/docs` เพื่อทดลอง request; `--reload` สำหรับ development เท่านั้น

**ผ่านเมื่อ:** ทดสอบหลาย candidates, malformed requests, invalid model และ input/output contract ผ่าน

**ไฟล์:** `ai-service/main.py`, `ai-service/src/schemas.py`, `ai-service/src/predictor.py`, `ai-service/src/model_loader.py`, `ai-service/tests/test_prediction_api.py`

## 11. ขั้น 7 — เชื่อมกับ NestJS

เริ่มเมื่อ scoring API ผ่านแล้ว แยก transport/application/domain/infrastructure ตาม AGENTS:

1. คำนวณ features จาก PAID history ก่อน cutoff เดียวกัน; สูตรตรง offline pipeline และมี parity tests
2. สร้าง candidates จาก templates ทั้ง 4 ตาม approved bounds
3. เรียก FastAPI ผ่าน adapter/port พร้อม timeout ที่กำหนด
4. ตรวจ response และใช้ configurable selection policy
5. revalidate eligibility แล้ว commit quest definition/assignment/log แบบ idempotent
6. ไม่ถือ transaction locks ระหว่างรอ AI; failure behavior ตาม policy ที่อนุมัติ

Service AI ไม่ต้องเชื่อม Neon เพื่อ scoring; NestJS ส่งเฉพาะข้อมูลที่จำเป็น ลดการเผยข้อมูลและ credential

**ไฟล์:** `apps/api/src/quest-recommendation/` (application use cases, domain policy, Prisma repository และ AI adapter), `apps/api/src/app.module.ts`, `apps/api/src/config/environment.ts`, `.env.example`, contracts ที่ generate จาก source

**ผ่านเมื่อ:** recommendation ใช้ข้อมูลจริงใน test DB ได้ บันทึก model/features/selection explanation ป้องกัน duplicate assignments และรับมือ AI ล่มโดยไม่ทำให้ payment เสีย

## 12. ขั้น 8 — Completion, points และข้อมูล feedback

เป็น dependency ของ full E2E ตามแผนเดิม เนื่องจากปัจจุบันยังไม่มี implementation ครบ

NestJS ตรวจ Paid Order เดียวของเจ้าของ assignment ในช่วง validity จาก snapshots: MIN_SPEND, CATEGORY_SPEND, PRODUCT_PURCHASE, MERCHANT_SPEND

ใช้ final amount หลังส่วนลด ไม่ใช้ userPaidAmount ที่หักสัดส่วน subsidy แล้ว; category allocation ยึด BR-QUEST-PRICING-01 ที่ยืนยันแล้ว

Completion, point ledger และ cached point balance commit atomically พร้อม uniqueness ป้องกัน retry/concurrency กรณี expired ใช้ finalized label 0; pending ไม่ใช่ failure

ต้องเลือกรูปแบบ trigger/delivery ตาม architecture โดยไม่เพิ่ม broker หรือ infra ใหม่เอง ถ้าใช้ asynchronous receipt processing ต้องมี durable outbox/idempotent handler ไม่ใช้ fire-and-forget ที่สูญหายได้

**ไฟล์:** `apps/api/src/quests/`, `apps/api/src/points/`, จุดเชื่อมใน `apps/api/src/order/order.service.ts`, integration tests ใน `apps/api/test/`

**Schema gate:** เสนอ constraints/snapshots/timezone/migration ที่จำเป็นเพื่อขออนุมัติแยกก่อนแก้ `apps/api/prisma/schema.prisma` หรือเพิ่ม migration

## 13. ขั้น 9 — ทดสอบทั้งระบบและเขียนคู่มือ

- prediction contract, train/inference parity, leakage, unseen category, cold-start
- AI timeout/invalid response, scores หาย/ซ้ำ/นอกช่วง, duplicate recommendation
- wrong-user receipt, order ก่อน assignment, expiry boundary, insufficient balance
- ยอดก่อนลดถึง threshold แต่หลังลดไม่ถึงต้องไม่สำเร็จ
- หลาย orders รวมถึง threshold แต่แต่ละ order ไม่ถึงต้องไม่สำเร็จ
- subsidy ไม่ลด spend สำหรับ quest
- concurrent/duplicate payment events ไม่สร้าง reward ซ้ำ
- real PostgreSQL integration tests สำหรับ rollback/uniqueness/concurrency; mocks ไม่ใช่หลักฐานส่วนนี้
- logs ไม่เผย PII/credentials; model version และ feature provenance ย้อนตรวจได้

หลังส่วนนี้จึงประเมินความพร้อมจริง ไม่กล่าวว่า production-ready จาก synthetic demo

ถ้าจะเปลี่ยนหน้า Quests ให้ใช้ API จริง ให้เสนอขอบเขต frontend แยกก่อน เพราะแผน AI นี้เน้น scoring และ backend integration

**ไฟล์:** `ai-service/README.md`, `docs/ai/RUNBOOK.md`, Python tests, `apps/api/test/ai-quest-recommendation.e2e-spec.ts`, CI ที่เกี่ยวข้อง

## 14. Requirement traceability ตามเลขปัจจุบัน

| Requirement    | สิ่งที่แผนต้องทำ                                          | หลักฐานที่ต้องมี                                                 |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| FR-C07         | personalized quest มอบหมายอัตโนมัติ สำเร็จ Order เดียว    | assignment + single-order tests                                  |
| FR-S01         | ใช้ประวัติ Paid Orders/Quest History เพื่อ recommendation | feature/dataset tests                                            |
| FR-S02         | แยก AI adapter และไม่ให้ AI อนุมัติ value                 | boundary/adapter tests                                           |
| FR-S03         | ตรวจ AI output และ policy                                 | invalid-output/eligibility tests                                 |
| FR-S04         | recommendation log                                        | persisted log integration test; audit-field gaps รอ decision     |
| FR-S05         | automatic assignment                                      | idempotent assignment test                                       |
| FR-S06         | deterministic completion/reward                           | single-order, discount, expiry, concurrent reward tests          |
| FR-C08         | point ledger/balance ที่ออกจาก quest                      | atomic reward/reconciliation tests; ไม่อ้างว่าหน้า Point ครบแล้ว |
| NFR-DATA-01/02 | atomicity และ exact financial arithmetic                  | real DB rollback/concurrency และ money tests                     |
| NFR-TIME-01    | UTC/timezone/expiry                                       | deterministic boundary tests                                     |
| NFR-OBS-01     | safe logs/metrics/audit                                   | metadata/redaction/failure checks                                |

FR-A05 เป็นข้อกำหนด trigger ฝั่ง Admin ที่มีอยู่ใน REQUIREMENTS แต่เวลาลงมือจริงต้องยืนยันว่าจะใช้ในขอบเขต integration รอบนี้อย่างไร ไม่เพิ่ม Admin UI เอง

## 15. การแบ่งงานที่แนะนำ

- ช่วง A: ปิดข้อกำหนด + ติดตั้ง environment + dataset design
- ช่วง B: synthetic pipeline + CatBoost + evaluation (หลังอนุมัติ synthetic)
- ช่วง C: FastAPI + automated prediction tests
- ช่วง D: NestJS integration + approved schema work ที่จำเป็น
- ช่วง E: deterministic completion/reward/expiry + full E2E

ทำจบและตรวจหลักฐานแต่ละช่วงก่อนต่อ ไม่ต้องเริ่มทุกส่วนพร้อมกัน

ก่อน implementation สร้าง ExecPlan ใน `.agent/plans/` ตาม `.agent/PLANS.md` พร้อม rollout, migration gate, verification และ progress; เอกสารนี้เป็น roadmap สำหรับผู้ใช้ ยังไม่ใช่บันทึกว่าพัฒนาเสร็จ

## 16. แหล่งติดตั้งที่ตรวจอ้างอิง

- Python Windows: https://docs.python.org/3.12/using/windows.html
- venv/pip: https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/
- CatBoost installation: https://catboost.ai/docs/en/installation/python-installation-method-pip-install
- FastAPI: https://fastapi.tiangolo.com/

ขั้นที่ 1 ผู้ใช้ทำเสร็จแล้วตามหลักฐานข้างต้น ส่วนคำสั่งฝึกโมเดล เปิด service และงานขั้นที่ 2–9 ยังเป็นขั้นตอนอนาคต ยังไม่มีการ migrate database
