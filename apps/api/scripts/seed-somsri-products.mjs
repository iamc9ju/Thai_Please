import 'dotenv/config';
import pg from 'pg';

// User-approved replacement catalogue; prices are decimal strings in THB.
const merchantName = 'ครัวสมศรีอาหารตามสั่ง';
const menu = [
  ['สินค้า OTOP และชุมชน', 'ตะกร้าสานชุมชน', '120.00'],
  ['สินค้า OTOP และชุมชน', 'สบู่สมุนไพรชุมชน', '35.00'],
  ['สินค้าอุปโภคบริโภค', 'น้ำยาล้างจาน 500 มล.', '30.00'],
  ['สินค้าอุปโภคบริโภค', 'กระดาษชำระ 6 ม้วน', '45.00'],
  ['สินค้าเกษตรและชุมชน', 'ผักบุ้งสด 1 กำ', '15.00'],
  ['สินค้าเกษตรและชุมชน', 'ไข่ไก่ 10 ฟอง', '50.00'],
  ['สุขภาพพื้นฐาน', 'หน้ากากอนามัย 10 ชิ้น', '25.00'],
  ['สุขภาพพื้นฐาน', 'พลาสเตอร์ปิดแผล 10 ชิ้น', '20.00'],
  ['เสื้อผ้าเเละเครื่องเเต่งกาย', 'เสื้อยืดผ้าฝ้าย', '150.00'],
  ['เสื้อผ้าเเละเครื่องเเต่งกาย', 'ผ้ากันเปื้อน', '90.00'],
];
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await db.connect();
  await db.query('BEGIN');
  const merchants = await db.query(
    'SELECT merchant_id FROM merchants WHERE merchant_name=$1 AND status=$2 FOR UPDATE',
    [merchantName, 'ACTIVE'],
  );
  if (merchants.rowCount !== 1)
    throw new Error('TARGET_MERCHANT_NOT_UNIQUE_OR_ACTIVE');
  const merchantId = merchants.rows[0].merchant_id;
  let inserted = 0;
  for (const [categoryName, name, price] of menu) {
    const categories = await db.query(
      'SELECT category_id FROM product_categories WHERE category_name=$1 AND status=$2',
      [categoryName, 'ACTIVE'],
    );
    if (categories.rowCount !== 1)
      throw new Error('TARGET_CATEGORY_NOT_UNIQUE_OR_ACTIVE');
    const result = await db.query(
      `INSERT INTO products (merchant_id,category_id,product_name,price,status)
       SELECT $1::bigint,$2::bigint,$3::varchar,$4::numeric,$5::varchar
       WHERE NOT EXISTS (SELECT 1 FROM products WHERE merchant_id=$1::bigint AND product_name=$3::varchar)`,
      [merchantId, categories.rows[0].category_id, name, price, 'ACTIVE'],
    );
    inserted += result.rowCount;
  }
  const products = await db.query(
    'SELECT product_name,price::text,status FROM products WHERE merchant_id=$1 ORDER BY product_id',
    [merchantId],
  );
  await db.query('COMMIT');
  console.log(
    JSON.stringify({ merchantName, inserted, products: products.rows }),
  );
} catch (error) {
  await db.query('ROLLBACK');
  console.log(error.code ?? error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
