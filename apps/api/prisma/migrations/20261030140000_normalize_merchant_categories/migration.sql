BEGIN;

CREATE TABLE "merchant_categories" (
  "merchant_category_id" BIGSERIAL PRIMARY KEY,
  "category_code" VARCHAR(50) NOT NULL UNIQUE,
  "category_name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_merchant_categories_status_sort"
ON "merchant_categories" ("status", "sort_order");

CREATE TABLE "merchant_category_assignments" (
  "merchant_id" BIGINT NOT NULL,
  "merchant_category_id" BIGINT NOT NULL,
  "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "merchant_category_assignments_pkey"
    PRIMARY KEY ("merchant_id", "merchant_category_id"),
  CONSTRAINT "merchant_category_assignments_merchant_id_fkey"
    FOREIGN KEY ("merchant_id") REFERENCES "merchants"("merchant_id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "merchant_category_assignments_category_id_fkey"
    FOREIGN KEY ("merchant_category_id") REFERENCES "merchant_categories"("merchant_category_id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "idx_merchant_category_assignments_category"
ON "merchant_category_assignments" ("merchant_category_id", "merchant_id");

INSERT INTO "merchant_categories"
  ("category_code", "category_name", "description", "sort_order")
VALUES
  ('FOOD_BEVERAGE', 'ร้านอาหารและเครื่องดื่ม', 'ร้านอาหารหรือเครื่องดื่มทุกประเภท', 10),
  ('RESTAURANT', 'ร้านอาหาร', 'ร้านที่ให้บริการอาหารเป็นหลัก', 20),
  ('MADE_TO_ORDER', 'ร้านอาหารตามสั่ง', 'อาหารปรุงตามรายการสั่งซื้อ', 30),
  ('THAI_CUISINE', 'ร้านอาหารไทย', 'อาหารไทยและอาหารพื้นบ้าน', 40),
  ('ISAN_CUISINE', 'ร้านอาหารอีสาน', 'อาหารอีสานและอาหารตะวันออกเฉียงเหนือ', 50),
  ('HALAL_FOOD', 'ร้านอาหารฮาลาล', 'อาหารที่ปฏิบัติตามหลักฮาลาล', 60),
  ('BEVERAGE_SHOP', 'ร้านเครื่องดื่ม', 'ชา กาแฟ น้ำผลไม้ และเครื่องดื่ม', 70),
  ('DESSERT_BAKERY', 'ร้านขนมและเบเกอรี', 'ขนมหวาน เบเกอรี และของว่าง', 80),
  ('OTOP', 'ร้าน OTOP', 'สินค้าหนึ่งตำบลหนึ่งผลิตภัณฑ์', 90),
  ('GENERAL_GOODS', 'ร้านค้าสินค้าทั่วไป', 'สินค้าอุปโภคบริโภคทั่วไป', 100),
  ('COMMUNITY_ENTERPRISE', 'วิสาหกิจชุมชน', 'ผู้ประกอบการวิสาหกิจชุมชน', 110),
  ('VILLAGE_COMMUNITY_FUND', 'ร้านค้ากองทุนหมู่บ้านหรือชุมชนเมือง', 'ร้านค้าที่ดำเนินงานโดยกองทุนชุมชน', 120),
  ('PUBLIC_TRANSPORT', 'ผู้ให้บริการขนส่งสาธารณะ', 'บริการขนส่งสาธารณะรายย่อย', 130),
  ('SMALL_LEGAL_ENTITY', 'นิติบุคคลขนาดเล็กที่เข้าเกณฑ์', 'นิติบุคคลขนาดเล็กที่ผ่านเกณฑ์โครงการ', 140),
  ('OTHER', 'อื่น ๆ', 'ประเภทร้านค้าอื่นที่ผ่านการอนุมัติ', 999);

ALTER TABLE "merchants"
DROP CONSTRAINT IF EXISTS "merchants_merchant_types_values_check";

ALTER TABLE "merchants"
ADD CONSTRAINT "merchants_merchant_types_values_check"
CHECK (
  "merchant_types" <@ ARRAY[
    'FOOD_BEVERAGE', 'RESTAURANT', 'MADE_TO_ORDER', 'THAI_CUISINE',
    'ISAN_CUISINE', 'HALAL_FOOD', 'BEVERAGE_SHOP', 'DESSERT_BAKERY',
    'OTOP', 'GENERAL_GOODS', 'COMMUNITY_ENTERPRISE',
    'VILLAGE_COMMUNITY_FUND', 'PUBLIC_TRANSPORT', 'SMALL_LEGAL_ENTITY', 'OTHER'
  ]::TEXT[]
);

INSERT INTO "merchant_category_assignments" ("merchant_id", "merchant_category_id")
SELECT DISTINCT m."merchant_id", c."merchant_category_id"
FROM "merchants" m
CROSS JOIN LATERAL unnest(m."merchant_types") AS type_code
JOIN "merchant_categories" c ON c."category_code" = type_code
ON CONFLICT DO NOTHING;

INSERT INTO "merchant_category_assignments" ("merchant_id", "merchant_category_id")
SELECT m."merchant_id", c."merchant_category_id"
FROM "merchants" m
JOIN "merchant_categories" c
  ON c."category_name" = m."merchant_type"
WHERE m."merchant_type" IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
