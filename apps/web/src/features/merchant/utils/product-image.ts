export function resolveProductImage(
  productName: string,
  categoryName?: string,
): string {
  const name = productName.trim().toLowerCase();
  const category = (categoryName ?? '').trim().toLowerCase();

  if (name.includes('กะเพราไก่') || name.includes('กระเพราไก่')) {
    return '/images/products/kaprao-chicken.jpg';
  }
  if (name.includes('กะเพรา') || name.includes('กระเพรา')) {
    return '/images/products/kaprao-pork.jpg';
  }
  if (name.includes('หมูกระเทียม') || name.includes('กระเทียม')) {
    return '/images/products/garlic-pork-rice.jpg';
  }
  if (name.includes('ข้าวผัด')) {
    return '/images/products/pork-fried-rice.jpg';
  }
  if (name.includes('ไข่เจียว')) {
    return '/images/products/omelet-rice.jpg';
  }
  if (name.includes('ไข่ดาว')) {
    return '/images/products/fried-egg-rice.jpg';
  }
  if (
    name.includes('ต้มจืด') ||
    name.includes('แกงจืด') ||
    name.includes('เต้าหู้')
  ) {
    return '/images/products/tofu-pork-soup.jpg';
  }
  if (name.includes('ข้าวสวย') || name.includes('ข้าวเปล่า')) {
    return '/images/products/jasmine-rice.jpg';
  }
  if (name.includes('ชาไทย') || name.includes('ชาเย็น')) {
    return '/images/products/thai-iced-tea.jpg';
  }
  if (
    name.includes('ชานม') ||
    name.includes('กาแฟ') ||
    name.includes('นมสด') ||
    name.includes('โกโก้')
  ) {
    return '/images/products/milk-tea.jpg';
  }
  if (
    name.includes('น้ำดื่ม') ||
    name.includes('น้ำเปล่า') ||
    name.includes('น้ำแร่') ||
    name.includes('น้ำสมุนไพร')
  ) {
    return '/images/products/drinking-water.jpg';
  }
  if (name.includes('อินทพาลัม') || name.includes('อินทผาลัม')) {
    return '/images/products/dates-fruit.jpg';
  }
  if (name.includes('เกษตร') || category.includes('เกษตร')) {
    return '/images/products/agri-product.jpg';
  }
  if (
    name.includes('otop') ||
    category.includes('otop') ||
    name.includes('วิสาหกิจ') ||
    name.includes('ชุมชน')
  ) {
    return '/images/products/otop-product.jpg';
  }

  return '/images/products/food-drink-combo.jpg';
}
