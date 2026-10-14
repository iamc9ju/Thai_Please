# AI service — ขั้นที่ 3: Synthetic data preparation

มีเฉพาะโปรแกรมสร้างข้อมูลจำลองและเตรียม CSV ยังไม่มี trained model, FastAPI หรือ NestJS integration

## รันใน PowerShell

```powershell
Set-Location 'C:\Users\koath\Desktop\web-app-project\Thai_Please\ai-service'
.\.venv\Scripts\python.exe prepare_data.py
.\.venv\Scripts\python.exe -m pytest
```

ต้องมี dependencies ตาม `requirements.txt` ใน venv ก่อน โปรแกรมไม่เชื่อม Database หรือรับ credentials

## ไฟล์ผลลัพธ์

- `data/raw_history.json`: users/catalog/orders/item snapshots/quest snapshots/assignments และ config ต้นทางชุดเดียว
- `data/feature_snapshots.json`: features ณ cutoff ของทุก assignment รวม active โดยไม่มี label ปะปนใน features
- `data/training_data.csv`: เฉพาะ finalized completed/expired, metadata ก่อน 20 features; null เป็นช่องว่าง
- `data/manifest.json`: SYNTHETIC, seed, currency scale, versions, hashes, จำนวนและข้อจำกัด

CSV เป็นข้อมูลจำลองสำหรับเรียนรู้ pipeline ไม่ใช่หลักฐานความแม่นยำกับผู้ใช้จริง ไม่มีการเทรนหรือรายงาน model performance ในขั้นนี้

## เปลี่ยนขนาดข้อมูล

แก้หรือทำสำเนา `config/synthetic_demo.json` แล้วใช้ `--config` และ `--output` แยกชุด ทุกค่าเป็น demo fixture parameters ไม่ใช่ policy ค่า default ของระบบจริง ตัวอย่างชุดเริ่มต้น: 60 users, 118 วัน, 9 assignments/user, interval 10 วัน, validity 7 วัน มีทั้งผู้ใช้ cold-start/ความถี่ซื้อต่างกันและ 4 quest types

ใช้ integer minor units ตาม currency scale ของ config; THB/2 เป็นเพียง fixture ชุดนี้ ไม่ hardcode currency ในสูตร สุ่ม order behavior แล้วใช้ exact deterministic rule หา outcomes ไม่สุ่ม label 1/0 แยกจาก orders

การมอบหมายไม่ overlap เพื่อหลีกเลี่ยงตัดสิน policy แจกแต้มหลาย assignments และไม่มีการโพสต์ point/wallet ledger ใน generator

รัน seed/config เดิมซ้ำได้ผล bytes/hash เดิม โปรแกรมยอม reuse ไฟล์เหมือนเดิม แต่ปฏิเสธเขียนทับ output ที่ต่างกัน เว้นแต่ระบุ `--overwrite` ชัดเจนหรือใช้โฟลเดอร์ผลลัพธ์ใหม่

## ตรวจประวัติที่บันทึกไว้

```powershell
.\.venv\Scripts\python.exe prepare_data.py --raw data/raw_history.json --output data/revalidated
```

ตรวจ schema, FK logical keys, ราคาทั้ง Order, UTC/time cutoff และ recompute outcome proof ถ้าข้อมูลผิดจะหยุด ไม่ซ่อม label เงียบ ๆ คำสั่งนี้ไม่ seed DB

## ใช้สาธิต NestJS ภายหลัง

logical keys ต้อง map เป็น Prisma IDs ผ่าน adapter และใช้ mapping เดียวกันสำหรับ categorical IDs แหล่งเดียวกันไม่ได้แปลว่าแทรก JSON ลง DB ได้ทันที: Paid Orders ใน DB ต้องมี ledgers/receipts/point rewards ที่ครบตาม invariants การ seed development DB เป็นงาน integration รอบหลังและยังไม่ได้ implement

อ่าน [Dataset schema](../docs/ai/DATASET_SCHEMA.md), [Feature definitions](../docs/ai/FEATURE_DEFINITIONS.md) และ [Roadmap](../docs/AI_BEGINNER_ROADMAP_TH.md)
