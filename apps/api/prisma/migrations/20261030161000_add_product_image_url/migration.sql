ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "image_url" VARCHAR(1000);

UPDATE "products"
SET "image_url" = CASE
  WHEN "product_name" ILIKE '%กะเพราไก่%' OR "product_name" ILIKE '%กระเพราไก่%' THEN 'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351620/thai-please-kaprao-chicken.jpg'
  WHEN "product_name" ILIKE '%กะเพรา%' OR "product_name" ILIKE '%กระเพรา%' THEN 'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351620/thai-please-kaprao-pork.jpg'
  WHEN "product_name" ILIKE '%หมูกระเทียม%' OR "product_name" ILIKE '%กระเทียม%' THEN 'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351618/thai-please-garlic-pork-rice.jpg'
  WHEN "product_name" ILIKE '%ข้าวผัด%' THEN 'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351624/thai-please-pork-fried-rice.jpg'
  WHEN "product_name" ILIKE '%ไข่เจียว%' THEN 'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351622/thai-please-omelet-rice.jpg'
  WHEN "product_name" ILIKE '%ไข่ดาว%' THEN 'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351617/thai-please-fried-egg-rice.jpg'
  WHEN "product_name" ILIKE '%ต้มจืด%' OR "product_name" ILIKE '%แกงจืด%' OR "product_name" ILIKE '%เต้าหู้%' THEN 'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351625/thai-please-tofu-pork-soup.jpg'
  WHEN "product_name" ILIKE '%ข้าวสวย%' OR "product_name" ILIKE '%ข้าวเปล่า%' THEN 'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351619/thai-please-jasmine-rice.jpg'
  WHEN "product_name" ILIKE '%ชาไทย%' OR "product_name" ILIKE '%ชาเย็น%' THEN 'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351625/thai-please-thai-iced-tea.jpg'
  WHEN "product_name" ILIKE '%ชานม%' OR "product_name" ILIKE '%กาแฟ%' OR "product_name" ILIKE '%นมสด%' OR "product_name" ILIKE '%โกโก้%' THEN 'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351621/thai-please-milk-tea.jpg'
  WHEN "product_name" ILIKE '%น้ำดื่ม%' OR "product_name" ILIKE '%น้ำเปล่า%' OR "product_name" ILIKE '%น้ำแร่%' OR "product_name" ILIKE '%น้ำสมุนไพร%' THEN 'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351615/thai-please-drinking-water.jpg'
  WHEN "product_name" ILIKE '%อินทพาลัม%' OR "product_name" ILIKE '%อินทผาลัม%' THEN 'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351614/thai-please-dates-fruit.jpg'
  WHEN "product_name" ILIKE '%เกษตร%' THEN 'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351613/thai-please-agri-product.jpg'
  WHEN "product_name" ILIKE '%otop%' OR "product_name" ILIKE '%วิสาหกิจ%' OR "product_name" ILIKE '%ชุมชน%' THEN 'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351623/thai-please-otop-product.jpg'
  ELSE 'https://res.cloudinary.com/dfxf4u91m/image/upload/v1793351616/thai-please-food-drink-combo.jpg'
END
WHERE "image_url" IS NULL;
