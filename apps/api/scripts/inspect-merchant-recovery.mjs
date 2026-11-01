import 'dotenv/config';
import pg from 'pg';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await db.connect();
  const history = await db.query(
    `SELECT oi.product_name_snapshot, oi.unit_price::text, oi.category_id::text,
       count(*)::int AS occurrences
     FROM order_items oi JOIN orders o ON o.order_id=oi.order_id
     JOIN merchants m ON m.merchant_id=o.merchant_id
     WHERE m.merchant_name=$1
     GROUP BY oi.product_name_snapshot,oi.unit_price,oi.category_id`,
    ['ครัวสมศรีอาหารตามสั่ง'],
  );
  console.log(JSON.stringify({ history: history.rows }));
  const categories = await db.query(
    'SELECT category_id::text,category_name,status FROM product_categories',
  );
  console.log(JSON.stringify({ categories: categories.rows }));
} catch (error) {
  console.log(error.code ?? 'RECOVERY_INSPECTION_FAILED');
  process.exitCode = 1;
} finally {
  await db.end();
}
